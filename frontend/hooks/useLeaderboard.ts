"use client";

import { useCallback, useEffect, useState } from "react";
import { leaderboard as leaderboardApi, type LeaderboardEntry } from "../lib/api";

type State = { entries: LeaderboardEntry[] | null; failed: boolean };

/**
 * The public ranked standings (GET /leaderboard): active players only, best
 * rating first. `entries` stays null until the first answer arrives.
 */
export default function useLeaderboard(limit: number) {
  const [state, setState] = useState<State>({ entries: null, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    leaderboardApi.top(limit).then(
      (entries) => {
        if (!cancelled) setState({ entries: Array.isArray(entries) ? entries : [], failed: false });
      },
      () => {
        // Keep whatever was shown before; the page offers a retry.
        if (!cancelled) setState((prev) => ({ entries: prev.entries, failed: true }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [limit, attempt]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, failed: false }));
    setAttempt((n) => n + 1);
  }, []);

  return {
    entries: state.entries,
    failed: state.failed,
    loading: state.entries === null && !state.failed,
    reload,
  };
}

/** Share of ranked matches won, e.g. "66.7%"; a dash before the first match. */
export function formatWinRate(wins: number, matchesPlayed: number): string {
  if (matchesPlayed <= 0) return "—";
  return `${Math.round((wins / matchesPlayed) * 1000) / 10}%`;
}
