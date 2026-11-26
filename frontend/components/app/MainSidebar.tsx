"use client";

import { BarChart3, Flame, Gem, LayoutGrid, Swords, Trophy, User, Users } from "lucide-react";
import { SideNav, type SideItem } from "../layout/AppLayout";
import useAuth from "../../hooks/useAuth";
import useProfile from "../../hooks/useProfile";
import { formatWinRate } from "../../hooks/useLeaderboard";

const items: SideItem[] = [
  { href: "/lobby", label: "Lobby", icon: LayoutGrid },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/how-it-works", label: "How It Works", icon: Trophy },
  { href: "/community", label: "Community", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

export function YourStatsCard() {
  const { stats } = useProfile();

  return (
    <div className="card p-4">
      <p className="eyebrow">Current Rating</p>
      <p className="mt-2 flex items-center gap-2 text-[24px] font-extrabold text-violet-300">
        <Gem size={19} className="text-violet-400" />
        {stats ? stats.rating : "—"}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
        {[
          { label: "Wins", value: stats?.wins ?? "—" },
          { label: "Losses", value: stats?.losses ?? "—" },
          { label: "Win Rate", value: stats ? formatWinRate(stats.wins, stats.matchesPlayed) : "—" },
        ].map((s) => (
          <div key={s.label}>
            <p className="eyebrow !text-[9.5px]">{s.label}</p>
            <p className="mt-1 text-[14px] font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
        <Flame size={17} className="text-amber" />
        <span>
          <span className="block text-[11px] text-dim">Best Win Streak</span>
          <span className="block text-[13px] font-bold">{stats?.bestStreak ?? "—"}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
        <Gem size={17} className="text-violet-400" />
        <span>
          <span className="block text-[11px] text-dim">Global Rank</span>
          <span className="block text-[13px] font-bold">
            {stats ? `#${stats.globalRank.toLocaleString()}` : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

export default function MainSidebar({ footer }: { footer?: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <>
      <SideNav items={items} />
      {user && (
        <div>
          <p className="eyebrow mb-2 px-1">Your Ranked Stats</p>
          <YourStatsCard />
        </div>
      )}
      {footer}
    </>
  );
}
