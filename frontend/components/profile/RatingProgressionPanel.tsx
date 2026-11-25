"use client";

import { useEffect, useState } from "react";
import { Panel } from "../ui/Bits";
import RatingLineChart from "../charts/RatingLineChart";
import { matches as matchesApi } from "../../lib/api";
import type { MatchHistoryEntry } from "../../lib/battle";

// The most matches the history API returns in one page.
const HISTORY_WINDOW = 50;

type Point = { label: string; value: number };

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The rating before the oldest ranked match in the window, then after each one. */
function ratingPoints(entries: MatchHistoryEntry[]): Point[] {
  const ranked = entries
    .filter((m): m is MatchHistoryEntry & { finishedAt: string } => m.ratingEligible && !!m.finishedAt)
    .sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
  if (ranked.length === 0) return [];
  const first = ranked[0];
  return [
    { label: dayLabel(first.finishedAt), value: first.ratingAfter - (first.ratingDelta ?? 0) },
    ...ranked.map((m) => ({ label: dayLabel(m.finishedAt), value: m.ratingAfter })),
  ];
}

/**
 * Rating over the player's recent ranked matches, from GET /matches/me/history
 * (rating after each match and its change). Hidden until there is one.
 */
export default function RatingProgressionPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    matchesApi.history(1, HISTORY_WINDOW).then(
      (res) => {
        if (!cancelled) setPoints(ratingPoints(res.matches));
      },
      () => {
        // Leave out the chart rather than show a broken one.
        if (!cancelled) setPoints([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!points || points.length < 2) return null;
  const rankedMatches = points.length - 1;

  return (
    <Panel
      title="Rating Progression"
      action={
        <span className="text-[11.5px] text-dim">
          Last {rankedMatches} ranked {rankedMatches === 1 ? "match" : "matches"}
        </span>
      }
      className="mt-4"
    >
      <RatingLineChart data={points} />
    </Panel>
  );
}
