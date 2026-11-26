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
 * (rating after each match and its change). The panel keeps the chart's size
 * while loading or empty, so the Match History below it (a link target) does
 * not move once the page has scrolled to it.
 */
export default function RatingProgressionPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    matchesApi.history(1, HISTORY_WINDOW).then(
      (res) => {
        if (cancelled) return;
        setPoints(ratingPoints(res.matches));
        setFailed(false);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const rankedMatches = points && points.length > 1 ? points.length - 1 : 0;

  return (
    <Panel
      title="Rating Progression"
      action={
        rankedMatches > 0 ? (
          <span className="text-[11.5px] text-dim">
            Last {rankedMatches} ranked {rankedMatches === 1 ? "match" : "matches"}
          </span>
        ) : undefined
      }
      className="mt-4"
    >
      {points && rankedMatches > 0 ? (
        <RatingLineChart data={points} />
      ) : (
        // Same proportions as the chart's 560x200 drawing.
        <div className="flex aspect-[14/5] w-full items-center justify-center rounded-lg bg-white/[0.02] px-4 text-center text-[12.5px] text-dim">
          {failed
            ? "Your rating history could not be loaded."
            : points
              ? "Your rating chart starts with your first ranked Quick Match."
              : "Loading…"}
        </div>
      )}
    </Panel>
  );
}
