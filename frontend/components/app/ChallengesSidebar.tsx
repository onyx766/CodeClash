"use client";

import Link from "next/link";
import { BarChart3, Flame, Gem, LayoutGrid, Swords, Trophy, Users } from "lucide-react";
import { SideNav, type SideItem } from "../layout/AppLayout";
import useProfile from "../../hooks/useProfile";
import { formatWinRate } from "../../hooks/useLeaderboard";

const items: SideItem[] = [
  { href: "/lobby", label: "Lobby", icon: LayoutGrid },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/how-it-works", label: "How It Works", icon: Trophy },
  { href: "/community", label: "Community", icon: Users },
];

export default function ChallengesSidebar() {
  const { stats } = useProfile();

  return (
    <>
      <SideNav items={items} />

      <div className="card p-5">
        <p className="eyebrow">Current Rating</p>
        <p className="mt-1.5 flex items-center gap-2 text-[28px] font-extrabold text-violet-300">
          <Gem size={22} className="text-violet-400" />
          {stats ? stats.rating : "—"}
        </p>
        <p className="mt-0.5 text-[11px] text-violet-200/70">
          {stats ? `Global rank #${stats.globalRank.toLocaleString()}` : "Global rank —"}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12.5px]">
          <span className="text-dim">
            Solved <span className="font-bold text-fg">{stats?.challengesSolved ?? "—"}</span>
          </span>
          <span className="text-dim">
            Win Rate{" "}
            <span className="font-bold text-fg">{stats ? formatWinRate(stats.wins, stats.matchesPlayed) : "—"}</span>
          </span>
        </div>
      </div>

      <div className="card flex items-center gap-3 p-4">
        <Flame size={22} className="text-amber shrink-0" />
        <span>
          <span className="block text-[20px] font-extrabold leading-none">
            {stats?.bestStreak ?? "—"} <span className="text-[12px] font-normal text-dim">wins</span>
          </span>
          <span className="mt-1 block text-[11px] text-dim">Best Ranked Win Streak</span>
        </span>
      </div>

      <div className="card p-4">
        <h2 className="text-[13.5px] font-bold">Ready to Battle?</h2>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-dim">
          Every match gives both players the same set of challenges from this catalogue.
        </p>
        <Link href="/lobby" className="btn btn-violet mt-4 w-full !py-2.5 !text-[12.5px]">
          Find a Match
        </Link>
      </div>
    </>
  );
}
