"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, matches as matchesApi } from "../lib/api";
import { joinChannel, onEveryConnect } from "../lib/socket";
import type { BattleMatch, ChallengeStatement } from "../lib/battle";
import useSocket from "./useSocket";

// Every one of these only means "something changed" - the handler refetches
// GET /matches/:id rather than trusting the payload, so a missed or duplicated
// event can never leave the page showing the wrong score.
const LIVE_EVENTS = [
  "match:progress",
  "challenge:solved",
  "challenge:attempting",
  "player:gave-up",
  "match:finished",
  "match:cancelled",
] as const;

export type BattleLoadError = { status: number; code?: string; message: string };

/**
 * Battle state for one match. HTTP is the source of truth (and what makes a
 * refresh recover everything); the socket's match channel only triggers
 * refetches. The channel is re-joined - and state refetched - on every
 * reconnect, so events missed while offline are caught up.
 */
export function useBattle(matchId: string) {
  const socket = useSocket();
  const [match, setMatch] = useState<BattleMatch | null>(null);
  const [statements, setStatements] = useState<ChallengeStatement[] | null>(null);
  const [error, setError] = useState<BattleLoadError | null>(null);
  const [live, setLive] = useState(false);
  // serverTime - local time, so the countdown follows the server's clock.
  const [clockSkewMs, setClockSkewMs] = useState(0);

  const refresh = useCallback((): Promise<BattleMatch | null> => {
    const sentAt = Date.now();
    return matchesApi.get(matchId).then(
      (res: { match: BattleMatch }) => {
        const receivedAt = Date.now();
        setClockSkewMs(new Date(res.match.serverTime).getTime() - (sentAt + receivedAt) / 2);
        setMatch(res.match);
        setError(null);
        return res.match;
      },
      (e: unknown) => {
        setError(
          e instanceof ApiError
            ? { status: e.status, code: e.code, message: e.message }
            : { status: 0, message: "Could not load this match." },
        );
        return null;
      },
    );
  }, [matchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Problem statements never change during a match - load them once.
  useEffect(() => {
    let cancelled = false;
    matchesApi
      .challenges(matchId)
      .then((res: { challenges: ChallengeStatement[] }) => {
        if (!cancelled) setStatements(res.challenges);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (!socket) return;
    let stopJoin = () => {};
    const stopConnect = onEveryConnect(socket, (reconnected) => {
      stopJoin();
      stopJoin = joinChannel(socket, "match:join", { matchId }, (ack) => setLive(!!ack.ok));
      // Catch up on anything that happened while disconnected.
      if (reconnected) void refresh();
    });
    const onDisconnect = () => setLive(false);
    const onEvent = (payload?: { matchId?: string }) => {
      if (payload?.matchId && payload.matchId !== matchId) return;
      void refresh();
    };

    socket.on("disconnect", onDisconnect);
    LIVE_EVENTS.forEach((event) => socket.on(event, onEvent));
    return () => {
      stopConnect();
      stopJoin();
      if (socket.connected) socket.emit("match:leave", { matchId });
      socket.off("disconnect", onDisconnect);
      LIVE_EVENTS.forEach((event) => socket.off(event, onEvent));
    };
  }, [socket, matchId, refresh]);

  return { match, statements, error, live, clockSkewMs, refresh };
}
