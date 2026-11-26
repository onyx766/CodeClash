"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, RotateCcw, Trophy } from "lucide-react";
import { Avatar, Panel, Tag, avatarForUserId } from "../ui/Bits";
import { ApiError, matches as matchesApi } from "../../lib/api";
import type { MatchHistoryEntry } from "../../lib/battle";
import { formatRelativeTime } from "../../lib/format";
import { revealHashTarget } from "../../lib/navigation";

const PAGE_SIZE = 10;

type Loaded = { entries: MatchHistoryEntry[]; page: number; totalPages: number; total: number };

const RESULT = {
  WIN: { label: "Victory", tone: "green" },
  LOSS: { label: "Defeat", tone: "rose" },
  DRAW: { label: "Draw", tone: "slate" },
} as const;

function RatingChange({ delta }: { delta: number | null }) {
  if (!delta) return <span className="w-10 shrink-0 text-right text-[12.5px] font-bold text-dim">±0</span>;
  return (
    <span
      className={`w-10 shrink-0 text-right text-[12.5px] font-bold ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}
    >
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

/**
 * The player's finished matches, newest first, a page at a time. Bump
 * `refreshKey` to reload from the first page, e.g. after a match ended.
 */
export default function MatchHistoryPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  useEffect(() => {
    let cancelled = false;
    matchesApi.history(1, PAGE_SIZE).then(
      (res) => {
        if (cancelled) return;
        setLoaded({
          entries: res.matches,
          page: 1,
          totalPages: res.pagination.totalPages,
          total: res.pagination.total,
        });
        setFailed(false);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey, attempt]);

  // Arriving at /profile#match-history (the lobby's "View All"), the browser
  // scrolls to this panel while it still says "Loading…"; the matches then
  // make the page longer and the panel ends up elsewhere. Go back to it once
  // the first page is in.
  const revealed = useRef(false);
  useEffect(() => {
    if (!loaded || revealed.current) return;
    revealed.current = true;
    revealHashTarget("match-history");
  }, [loaded]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const loadMore = async () => {
    if (!loaded || loadingMore) return;
    setLoadingMore(true);
    setMoreError("");
    try {
      const res = await matchesApi.history(loaded.page + 1, PAGE_SIZE);
      setLoaded((prev) => {
        if (!prev) return prev;
        // A match that finished meanwhile shifts the pages: skip repeats.
        const seen = new Set(prev.entries.map((e) => e.matchId));
        return {
          entries: [...prev.entries, ...res.matches.filter((m) => !seen.has(m.matchId))],
          page: prev.page + 1,
          totalPages: res.pagination.totalPages,
          total: res.pagination.total,
        };
      });
    } catch (e) {
      setMoreError(e instanceof ApiError ? e.message : "Could not load more matches.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Panel
      id="match-history"
      title="Match History"
      action={loaded && loaded.total > 0 ? <span className="text-[12px] text-dim">{loaded.total} played</span> : undefined}
      className="mt-4 scroll-mt-24"
      bodyClassName="!px-0 !pb-0"
    >
      {!loaded ? (
        failed ? (
          <div className="px-4 py-6">
            <p className="text-[12.5px] text-dim">Your match history could not be loaded.</p>
            <button type="button" onClick={retry} className="btn btn-ghost mt-3 !py-2 !text-[12.5px]">
              <RotateCcw size={14} /> Try again
            </button>
          </div>
        ) : (
          <p className="px-4 py-6 text-[12.5px] text-dim">Loading…</p>
        )
      ) : loaded.entries.length === 0 ? (
        <p className="px-4 py-6 text-[12.5px] text-dim">
          No finished matches yet. Play a Quick Match or a private room and your results will appear here.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line/70">
            {loaded.entries.map((m) => {
              const name = m.opponent?.displayName || m.opponent?.username || "Unknown player";
              const avatar = m.opponent?.avatarUrl || avatarForUserId(m.opponent?.id ?? m.matchId);
              const result = RESULT[m.result];
              return (
                <li key={m.matchId}>
                  <Link
                    href={`/match/${m.matchId}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <Tag tone={result.tone} className="w-[58px] shrink-0 justify-center">
                      {result.label}
                    </Tag>
                    <Avatar src={avatar} alt={name} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">vs {name}</span>
                      <span className="block truncate text-[11px] text-dim">
                        {m.ratingEligible ? "Ranked · Quick Match" : "Casual · Private room"}
                      </span>
                    </span>
                    {m.ratingEligible && (
                      <>
                        <RatingChange delta={m.ratingDelta} />
                        <span className="hidden shrink-0 items-center gap-1 text-[12px] font-semibold text-amber sm:flex">
                          <Trophy size={11} /> {m.ratingAfter}
                        </span>
                      </>
                    )}
                    <span className="w-16 shrink-0 text-right text-[11px] text-dim">
                      {formatRelativeTime(m.finishedAt)}
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-dim" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {(loaded.page < loaded.totalPages || moreError) && (
            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line px-4 py-3">
              {moreError && <span className="text-[12px] text-rose-300">{moreError}</span>}
              {loaded.page < loaded.totalPages && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="btn btn-ghost !py-2 !text-[12.5px]"
                >
                  {loadingMore ? "Loading…" : "Show more"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
