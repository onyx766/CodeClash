"use client";

import Link from "next/link";
import { Gem } from "lucide-react";
import { Avatar, Panel, avatarForUserId } from "../ui/Bits";
import RankBadge from "../ui/RankBadge";
import useLeaderboard from "../../hooks/useLeaderboard";

/** The first few rows of the ranked standings, for a page's side rail. */
export default function TopPlayersPanel({ title = "Top Players", limit = 5 }: { title?: string; limit?: number }) {
  const { entries, failed, loading } = useLeaderboard(limit);

  return (
    <Panel
      title={title}
      action={
        <Link href="/leaderboard" className="link-quiet">
          View All
        </Link>
      }
      bodyClassName="space-y-3"
    >
      {loading ? (
        <p className="text-[12px] text-dim">Loading…</p>
      ) : failed ? (
        <p className="text-[12px] text-dim">The standings are unavailable right now.</p>
      ) : !entries?.length ? (
        <p className="text-[12px] text-dim">No ranked players yet.</p>
      ) : (
        entries.map((entry) => {
          const name = entry.displayName || entry.username;
          return (
            <div key={entry.id} className="flex items-center gap-2.5">
              <RankBadge rank={entry.rank} size={22} />
              <Avatar src={entry.avatarUrl || avatarForUserId(entry.id)} alt={name} size={28} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{name}</span>
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-violet-300">
                <Gem size={11} /> {entry.rating}
              </span>
            </div>
          );
        })
      )}
    </Panel>
  );
}
