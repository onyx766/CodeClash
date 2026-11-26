"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Handshake, Swords, Trophy } from "lucide-react";
import { IconBadge, Panel } from "../ui/Bits";
import TopPlayersPanel from "./TopPlayersPanel";
import { matches as matchesApi } from "../../lib/api";
import type { MatchHistoryEntry } from "../../lib/battle";
import { formatRelativeTime } from "../../lib/format";

const RECENT_MATCHES = 4;

function describe(match: MatchHistoryEntry) {
  const opponent = match.opponent?.displayName || match.opponent?.username || "your opponent";
  if (match.result === "WIN") return { icon: Trophy, tone: "green" as const, title: `You beat ${opponent}` };
  if (match.result === "LOSS") return { icon: Swords, tone: "rose" as const, title: `You lost to ${opponent}` };
  return { icon: Handshake, tone: "amber" as const, title: `Draw with ${opponent}` };
}

function ratingNote(match: MatchHistoryEntry) {
  if (!match.ratingEligible) return "Casual · rating unchanged";
  if (!match.ratingDelta) return "Ranked · rating unchanged";
  return `Ranked · ${match.ratingDelta > 0 ? "+" : ""}${match.ratingDelta} rating`;
}

/** The player's last few finished matches (GET /matches/me/history). */
function RecentActivity() {
  const [matches, setMatches] = useState<MatchHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    matchesApi.history(1, RECENT_MATCHES).then(
      (res) => {
        if (!cancelled) setMatches(res.matches);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel
      title="Recent Activity"
      action={
        <Link href="/profile#match-history" className="link-quiet">
          View All
        </Link>
      }
      bodyClassName="space-y-2.5"
    >
      {matches === null ? (
        <p className="text-[12px] text-dim">{failed ? "Your recent matches could not be loaded." : "Loading…"}</p>
      ) : matches.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-dim">No finished matches yet. Your results will show up here.</p>
      ) : (
        matches.map((match) => {
          const { icon: Icon, tone, title } = describe(match);
          return (
            <Link
              key={match.matchId}
              href={`/match/${match.matchId}`}
              className="-mx-1.5 flex items-start gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.03]"
            >
              <IconBadge tone={tone} size={32} rounded="rounded-lg">
                <Icon size={15} />
              </IconBadge>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold leading-snug">{title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-dim">{ratingNote(match)}</span>
              </span>
              <span className="shrink-0 text-[10.5px] text-dim">{formatRelativeTime(match.finishedAt)}</span>
            </Link>
          );
        })
      )}
    </Panel>
  );
}

export default function LobbyRail() {
  return (
    <>
      <RecentActivity />
      <TopPlayersPanel />
    </>
  );
}
