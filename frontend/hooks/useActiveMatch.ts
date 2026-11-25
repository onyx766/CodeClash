"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { matches as matchesApi } from "../lib/api";
import type { MatchStatus } from "../lib/battle";
import { requestOrder } from "../lib/requestOrder";
import { joinChannel, onEveryConnect } from "../lib/socket";
import useSocket from "./useSocket";

export type ActiveMatch = { id: string; status: MatchStatus; type: "QUICK_MATCH" | "PRIVATE_ROOM" };

/**
 * The player's unfinished match (GET /matches/me/active), kept current while
 * the page is open. The page subscribes to that match's channel; when the
 * match finishes or is cancelled - say, the player left the battle page and
 * the clock ran out - the active match is re-read and `onEnded` runs, so the
 * page can refresh stats that the result changed.
 */
export default function useActiveMatch(onEnded?: () => void): ActiveMatch | null {
  const socket = useSocket();
  const [match, setMatch] = useState<ActiveMatch | null>(null);

  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // The first load, socket events and reconnects all re-read the match, and
  // the answers can arrive out of order: a read sent before the match ended
  // must not bring it back after a newer read cleared it.
  const [order] = useState(requestOrder);
  const reload = useCallback(() => {
    const id = order.next();
    return matchesApi.active().then(
      (res: { match: ActiveMatch | null }) => {
        if (order.accept(id)) setMatch(res?.match ?? null);
      },
      () => undefined, // keep what we have; the next event or visit re-reads it
    );
  }, [order]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const matchId = match?.id ?? null;

  // A Quick Match that starts, or whose ready check fails, is announced on
  // the player's own channel.
  useEffect(() => {
    if (!socket) return;
    const onStarted = () => void reload();
    const onCancelledSearch = (payload?: { matchId?: string }) => {
      if (payload?.matchId && payload.matchId === matchId) void reload();
    };
    socket.on("match:started", onStarted);
    socket.on("matchmaking:cancelled", onCancelledSearch);
    return () => {
      socket.off("match:started", onStarted);
      socket.off("matchmaking:cancelled", onCancelledSearch);
    };
  }, [socket, matchId, reload]);

  useEffect(() => {
    if (!socket || !matchId) return;
    let stopJoin = () => {};
    const stopConnect = onEveryConnect(socket, (reconnected) => {
      stopJoin();
      stopJoin = joinChannel(socket, "match:join", { matchId });
      // Anything that happened while the socket was down.
      if (reconnected) void reload();
    });
    const onEnd = (payload?: { matchId?: string }) => {
      if (payload?.matchId && payload.matchId !== matchId) return;
      void reload();
      onEndedRef.current?.();
    };
    socket.on("match:finished", onEnd);
    socket.on("match:cancelled", onEnd);
    return () => {
      stopConnect();
      stopJoin();
      if (socket.connected) socket.emit("match:leave", { matchId });
      socket.off("match:finished", onEnd);
      socket.off("match:cancelled", onEnd);
    };
  }, [socket, matchId, reload]);

  return match;
}
