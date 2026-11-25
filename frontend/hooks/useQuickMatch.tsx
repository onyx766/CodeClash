"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, auth, matches as matchesApi, matchmaking as matchmakingApi } from "../lib/api";
import {
  describeCancellation,
  rememberMatchFound,
  type MatchFoundPayload,
  type MatchmakingCancelledPayload,
  type MatchmakingState,
  type QuickMatchNotice,
  type RatingRange,
} from "../lib/matchmaking";
import { flashTitle } from "../lib/titleFlash";
import useAuth from "./useAuth";
import useSocket from "./useSocket";

export type { QuickMatchNotice };

export type QuickMatchPhase = "idle" | "starting" | "searching" | "cancelling";

export type QuickMatchSearch = { joinedAt: string; rating: number; ratingRange: RatingRange };

type QuickMatchContextValue = {
  phase: QuickMatchPhase;
  search: QuickMatchSearch | null;
  notice: QuickMatchNotice | null;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
  dismissNotice: () => void;
  /** Re-reads the queue state, e.g. after a ready check failed and the server may have re-queued us. */
  sync: () => Promise<void>;
};

type State = {
  owner: string | null;
  phase: QuickMatchPhase;
  search: QuickMatchSearch | null;
  notice: QuickMatchNotice | null;
};
type Patch = Partial<Omit<State, "owner">>;

const IDLE: Omit<State, "owner"> = { phase: "idle", search: null, notice: null };

// GET /matchmaking/quick is also the queue heartbeat: a searcher the server
// has not heard from for ~10 s is dropped.
const POLL_MS = 3_000;

/** How long a found match's title flash may outlast its ready deadline (clocks differ). */
const FLASH_GRACE_MS = 2_000;

const QuickMatchContext = createContext<QuickMatchContextValue | null>(null);

async function startFailureNotice(err: unknown): Promise<QuickMatchNotice> {
  if (!(err instanceof ApiError)) return { tone: "error", text: "Could not start Quick Match.", retry: true };
  if (err.code === "ACTIVE_ROOM_EXISTS") {
    const room = await auth
      .me()
      .then((res) => (res.activeRoom as { id: string } | null) ?? null)
      .catch(() => null);
    return {
      tone: "error",
      text: err.message,
      action: room ? { label: "Go to your room", href: `/rooms/${room.id}` } : undefined,
    };
  }
  if (err.code === "ACTIVE_MATCH_EXISTS") {
    const match = await matchesApi
      .active()
      .then((res) => (res.match as { id: string } | null) ?? null)
      .catch(() => null);
    return {
      tone: "error",
      text: err.message,
      action: match ? { label: "Return to your match", href: `/match/${match.id}` } : undefined,
    };
  }
  if (err.code === "MATCHMAKING_UNAVAILABLE") {
    return { tone: "error", text: "Matchmaking is temporarily unavailable. Please try again in a moment.", retry: true };
  }
  return { tone: "error", text: err.message, retry: err.status === 0 || err.status >= 500 };
}

/**
 * The player's Quick Match search. Lives above the pages, so a search keeps
 * its heartbeat while the player browses, and a found match opens wherever
 * they are.
 */
export function QuickMatchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const pathname = usePathname();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>({ owner: null, ...IDLE });

  // Read from async callbacks, which must not act for a player who has since
  // signed out or been replaced.
  const userIdRef = useRef(userId);
  const pathnameRef = useRef(pathname);
  const openedMatchRef = useRef<{ matchId: string; at: number } | null>(null);
  useEffect(() => {
    userIdRef.current = userId;
    pathnameRef.current = pathname;
  }, [userId, pathname]);

  // A match found while the player is in another tab flashes the tab title
  // until they come back or the ready check ends.
  const titleFlashRef = useRef<{ matchId: string; stop: () => void } | null>(null);
  const stopTitleFlash = useCallback((matchId?: string) => {
    const flash = titleFlashRef.current;
    if (!flash || (matchId && flash.matchId !== matchId)) return;
    titleFlashRef.current = null;
    flash.stop();
  }, []);
  // Never outlives the player it was for.
  useEffect(() => () => stopTitleFlash(), [userId, stopTitleFlash]);

  const update = useCallback((owner: string, patch: Patch | ((prev: State) => Patch)) => {
    if (owner !== userIdRef.current) return;
    setState((prev) => {
      const base: State = prev.owner === owner ? prev : { owner, ...IDLE };
      return { ...base, ...(typeof patch === "function" ? patch(base) : patch) };
    });
  }, []);

  const openMatch = useCallback(
    (matchId: string) => {
      // The POST answer, the poll and the socket event can all report the
      // same match within moments of each other: navigate once.
      const last = openedMatchRef.current;
      const now = Date.now();
      if (last?.matchId === matchId && now - last.at < 3_000) return;
      openedMatchRef.current = { matchId, at: now };
      if (pathnameRef.current !== `/match/${matchId}`) router.push(`/match/${matchId}`);
    },
    [router],
  );

  const apply = useCallback(
    (owner: string, mm: MatchmakingState, openFound: boolean) => {
      if (mm.status === "SEARCHING") {
        update(owner, {
          phase: "searching",
          search: { joinedAt: mm.joinedAt, rating: mm.rating, ratingRange: mm.ratingRange },
        });
        return;
      }
      update(owner, { phase: "idle", search: null });
      if (mm.status === "MATCHED" && openFound) openMatch(mm.matchId);
    },
    [update, openMatch],
  );

  const sync = useCallback(async () => {
    const owner = userIdRef.current;
    if (!owner) return;
    try {
      const res = await matchmakingApi.status();
      apply(owner, res.matchmaking, false);
    } catch {
      // Keep what we have; the next poll or action tries again.
    }
  }, [apply]);

  const start = useCallback(async () => {
    const owner = userIdRef.current;
    if (!owner) return;
    update(owner, { phase: "starting", notice: null });
    try {
      const res = await matchmakingApi.start();
      apply(owner, res.matchmaking, true);
    } catch (err) {
      const notice = await startFailureNotice(err);
      update(owner, { phase: "idle", search: null, notice });
    }
  }, [apply, update]);

  const cancel = useCallback(async () => {
    const owner = userIdRef.current;
    if (!owner) return;
    update(owner, { phase: "cancelling", notice: null });
    try {
      const res = await matchmakingApi.cancel();
      apply(owner, res.matchmaking, false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "MATCH_ALREADY_FOUND") {
        // Too late to cancel: an opponent has been found.
        const matchId = typeof err.details.matchId === "string" ? err.details.matchId : null;
        if (matchId) {
          update(owner, { phase: "idle", search: null });
          openMatch(matchId);
        } else {
          // The pairing is still being saved; open it once it shows up.
          update(owner, { phase: "searching" });
          setTimeout(() => {
            matchmakingApi
              .status()
              .then((res) => apply(owner, res.matchmaking, true))
              .catch(() => undefined);
          }, 700);
        }
        return;
      }
      update(owner, {
        phase: "searching",
        notice: { tone: "error", text: err instanceof ApiError ? err.message : "Could not cancel the search." },
      });
    }
  }, [apply, update, openMatch]);

  const dismissNotice = useCallback(() => {
    const owner = userIdRef.current;
    if (owner) update(owner, { notice: null });
  }, [update]);

  // Pick up a search that outlived a reload.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    matchmakingApi
      .status()
      .then((res) => {
        if (!cancelled) apply(userId, res.matchmaking, false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, apply]);

  const visible: State = state.owner === userId ? state : { owner: userId, ...IDLE };
  const phase = visible.phase;

  // Heartbeat and fallback for missed events while searching.
  useEffect(() => {
    if (!userId || phase !== "searching") return;
    const owner = userId;
    const id = setInterval(() => {
      matchmakingApi
        .status()
        .then((res) => {
          if (res.matchmaking.status !== "IDLE") {
            apply(owner, res.matchmaking, true);
            return;
          }
          // Dropped from the queue without us hearing about it.
          update(owner, (prev) =>
            prev.phase === "searching"
              ? {
                  phase: "idle",
                  search: null,
                  notice: prev.notice?.tone === "error" ? prev.notice : { tone: "info", text: "Your search has stopped.", retry: true },
                }
              : {},
          );
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [userId, phase, apply, update]);

  useEffect(() => {
    if (!socket || !userId) return;
    const owner = userId;
    const onSearching = (payload: MatchmakingState) => {
      if (payload?.status === "SEARCHING") apply(owner, payload, false);
    };
    const onFound = (payload: MatchFoundPayload) => {
      if (!payload?.matchId) return;
      rememberMatchFound(payload);
      update(owner, { phase: "idle", search: null, notice: null });
      if (document.hidden) {
        stopTitleFlash();
        // Until the ready check is over at the latest; its start or failure
        // (below) usually ends the flash sooner.
        const deadline = Date.parse(payload.readyDeadline);
        titleFlashRef.current = {
          matchId: payload.matchId,
          stop: flashTitle("Match found!", {
            until: (Number.isFinite(deadline) ? deadline : Date.now() + 30_000) + FLASH_GRACE_MS,
          }),
        };
      }
      openMatch(payload.matchId);
    };
    const onCancelled = (payload?: MatchmakingCancelledPayload) => {
      const { readyCheck, notice } = describeCancellation(payload);
      if (readyCheck) {
        stopTitleFlash(payload?.matchId);
        // A ready check that failed: the battle page explains it in detail,
        // the lobby shows the notice. Whoever accepted in time hears
        // matchmaking:opponent-unavailable instead and is back in the queue.
        update(owner, { notice });
        return;
      }
      // No match involved: the server took us out of the queue.
      update(owner, (prev) =>
        prev.phase === "searching" || prev.phase === "cancelling" ? { phase: "idle", search: null, notice } : {},
      );
    };
    const onOpponentUnavailable = (payload?: { matchId?: string }) => {
      stopTitleFlash(payload?.matchId);
      // The server puts whoever accepted straight back in the queue.
      update(owner, {
        phase: "searching",
        notice: { tone: "info", text: "Your opponent didn't accept in time. You're back in the queue." },
      });
      void sync();
    };
    const onError = (payload?: { message?: string }) => {
      update(owner, {
        notice: { tone: "error", text: payload?.message || "Matchmaking ran into a problem.", retry: true },
      });
      void sync();
    };
    // Both players get this once a match starts. The room page handles its own.
    const onStarted = (payload?: { matchId?: string }) => {
      if (!payload?.matchId) return;
      stopTitleFlash(payload.matchId);
      if (pathnameRef.current.startsWith("/rooms/")) return;
      openMatch(payload.matchId);
    };
    socket.on("matchmaking:searching", onSearching);
    socket.on("matchmaking:match-found", onFound);
    socket.on("matchmaking:cancelled", onCancelled);
    socket.on("matchmaking:opponent-unavailable", onOpponentUnavailable);
    socket.on("matchmaking:error", onError);
    socket.on("match:started", onStarted);
    return () => {
      socket.off("matchmaking:searching", onSearching);
      socket.off("matchmaking:match-found", onFound);
      socket.off("matchmaking:cancelled", onCancelled);
      socket.off("matchmaking:opponent-unavailable", onOpponentUnavailable);
      socket.off("matchmaking:error", onError);
      socket.off("match:started", onStarted);
    };
  }, [socket, userId, apply, update, openMatch, sync, stopTitleFlash]);

  const value = useMemo(
    () => ({
      phase,
      search: visible.search,
      notice: visible.notice,
      start,
      cancel,
      dismissNotice,
      sync,
    }),
    [phase, visible.search, visible.notice, start, cancel, dismissNotice, sync],
  );

  return <QuickMatchContext.Provider value={value}>{children}</QuickMatchContext.Provider>;
}

export default function useQuickMatch() {
  const ctx = useContext(QuickMatchContext);
  if (!ctx) {
    throw new Error("useQuickMatch must be used within a QuickMatchProvider");
  }
  return ctx;
}
