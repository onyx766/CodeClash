"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, matches as matchesApi } from "../lib/api";
import { joinChannel, onEveryConnect } from "../lib/socket";
import type { BattleMatch, ChallengeStatement, MatchStatus } from "../lib/battle";
import {
  readyCheckEndFor,
  recallMatchFound,
  type MatchFoundPayload,
  type MatchmakingCancelledPayload,
  type ReadyCheckEnd,
} from "../lib/matchmaking";
import useSocket from "./useSocket";

// Every one of these only means "something changed" - the handler refetches
// GET /matches/:id rather than trusting the payload, so a missed or duplicated
// event can never leave the page showing the wrong score. match:started comes
// on the player's own channel when both players have accepted a Quick Match.
const LIVE_EVENTS = [
  "match:started",
  "match:progress",
  "challenge:solved",
  "challenge:attempting",
  "player:gave-up",
  "match:finished",
  "match:cancelled",
] as const;

/** Statuses of a match that has not started yet (a Quick Match ready check). */
export const AWAITING_START: MatchStatus[] = ["PENDING", "PENDING_READY", "READY"];

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
  // The ready deadline from the match-found event, for API versions whose
  // GET /matches/:id does not send match.readyDeadline.
  const [foundDeadline, setFoundDeadline] = useState<string | null>(
    () => recallMatchFound(matchId)?.readyDeadline ?? null,
  );
  const [readyCheckEnd, setReadyCheckEnd] = useState<ReadyCheckEnd | null>(null);
  // Players announced by match:ready as they accept the ready check. GET
  // /matches/:id says so too (each player's `ready`), but only when re-read.
  const [acceptedBy, setAcceptedBy] = useState<string[]>([]);
  const [statementsAttempt, setStatementsAttempt] = useState(0);
  // Polls, socket events and the player's own actions all re-read the match,
  // and their answers can arrive out of order. Only an answer at least as new
  // as the one on screen may replace it - otherwise a read sent before the
  // match finished could put a finished match back "in progress".
  const lastSent = useRef(0);
  const lastShown = useRef(0);

  const refresh = useCallback((): Promise<BattleMatch | null> => {
    const id = ++lastSent.current;
    const sentAt = Date.now();
    return matchesApi.get(matchId).then(
      (res: { match: BattleMatch }) => {
        if (id < lastShown.current) return res.match;
        lastShown.current = id;
        const receivedAt = Date.now();
        setClockSkewMs(new Date(res.match.serverTime).getTime() - (sentAt + receivedAt) / 2);
        setMatch(res.match);
        setError(null);
        return res.match;
      },
      (e: unknown) => {
        if (id < lastShown.current) return null;
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

  // Problem statements never change during a match, but a Quick Match only
  // gets its challenge set once both players have accepted. Load them as soon
  // as the match has challenges, and keep retrying until that succeeds.
  const challengeCount = match?.challenges.length ?? 0;
  const statementsLoaded = (statements?.length ?? 0) > 0;
  useEffect(() => {
    if (challengeCount === 0 || statementsLoaded) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const retryLater = () => {
      retry = setTimeout(() => setStatementsAttempt((n) => n + 1), 2000);
    };
    matchesApi.challenges(matchId).then(
      (res: { challenges: ChallengeStatement[] }) => {
        if (cancelled) return;
        if (res.challenges.length > 0) setStatements(res.challenges);
        else retryLater();
      },
      () => {
        if (!cancelled) retryLater();
      },
    );
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [matchId, challengeCount, statementsLoaded, statementsAttempt]);

  // The ready check only lasts seconds: follow it closely, whatever the socket does.
  const awaitingStart = !!match && AWAITING_START.includes(match.status);
  useEffect(() => {
    if (!awaitingStart) return;
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [awaitingStart, refresh]);

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
    // Quick Match ready check, on the player's own channel.
    const onFound = (payload?: MatchFoundPayload) => {
      if (payload?.matchId === matchId && payload.readyDeadline) setFoundDeadline(payload.readyDeadline);
    };
    const readyCheckEnded = (end: ReadyCheckEnd, payload?: { matchId?: string }) => {
      if (payload?.matchId !== matchId) return;
      setReadyCheckEnd(end);
      void refresh();
    };
    // READY_TIMEOUT: this player did not accept in time; START_FAILED: both
    // did, but the match could not be started.
    const onCancelled = (payload?: MatchmakingCancelledPayload) => readyCheckEnded(readyCheckEndFor(payload), payload);
    const onOpponentUnavailable = (payload?: { matchId?: string }) => readyCheckEnded("opponent-unavailable", payload);
    const onAccepted = (payload?: { matchId?: string; userId?: string }) => {
      const userId = payload?.userId;
      if (payload?.matchId !== matchId || !userId) return;
      setAcceptedBy((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    };

    socket.on("disconnect", onDisconnect);
    LIVE_EVENTS.forEach((event) => socket.on(event, onEvent));
    socket.on("matchmaking:match-found", onFound);
    socket.on("matchmaking:cancelled", onCancelled);
    socket.on("matchmaking:opponent-unavailable", onOpponentUnavailable);
    socket.on("match:ready", onAccepted);
    return () => {
      stopConnect();
      stopJoin();
      if (socket.connected) socket.emit("match:leave", { matchId });
      socket.off("disconnect", onDisconnect);
      LIVE_EVENTS.forEach((event) => socket.off(event, onEvent));
      socket.off("matchmaking:match-found", onFound);
      socket.off("matchmaking:cancelled", onCancelled);
      socket.off("matchmaking:opponent-unavailable", onOpponentUnavailable);
      socket.off("match:ready", onAccepted);
    };
  }, [socket, matchId, refresh]);

  const readyDeadline = match?.readyDeadline ?? foundDeadline;

  return { match, statements, error, live, clockSkewMs, refresh, readyDeadline, readyCheckEnd, acceptedBy };
}
