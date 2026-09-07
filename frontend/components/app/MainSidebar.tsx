import Link from "next/link";
import { BarChart3, Flame, Gem, LayoutGrid, Swords, Trophy, User, Users } from "lucide-react";
import { SideNav, type SideItem } from "../layout/AppLayout";
import { currentUser } from "../../lib/demo";

const items: SideItem[] = [
  { href: "/lobby", label: "Lobby", icon: LayoutGrid },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/how-it-works", label: "How It Works", icon: Trophy },
  { href: "/community", label: "Community", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

function Sparkline() {
  return (
    <svg viewBox="0 0 120 34" className="mt-3 h-9 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-violet)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-violet)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 28 L15 24 L30 26 L45 18 L60 20 L75 12 L90 14 L105 6 L120 4 L120 34 L0 34 Z"
        fill="url(#spark)"
      />
      <path
        d="M0 28 L15 24 L30 26 L45 18 L60 20 L75 12 L90 14 L105 6 L120 4"
        fill="none"
        stroke="var(--color-violet)"
        strokeWidth="1.6"
      />
      <circle cx="120" cy="4" r="2.6" fill="var(--color-violet)" />
    </svg>
  );
}

export function YourStatsCard() {
  const u = currentUser;
  return (
    <div className="card p-4">
      <p className="eyebrow">Current Rating</p>
      <p className="mt-2 flex items-center gap-2 text-[24px] font-extrabold text-violet-300">
        <Gem size={19} className="text-violet-400" />
        {u.rating}
      </p>
      <p className="mt-1 text-[11px] text-dim">Top {u.topPercent}</p>

      <Sparkline />

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
        {[
          { label: "Wins", value: u.wins },
          { label: "Losses", value: u.losses },
          { label: "Win Rate", value: `${u.winRate}%` },
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
          <span className="block text-[11px] text-dim">Best Streak</span>
          <span className="block text-[13px] font-bold">{u.streak}</span>
          <span className="block text-[10.5px] text-dim">Matches</span>
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
        <Gem size={17} className="text-violet-400" />
        <span>
          <span className="block text-[11px] text-dim">Global Rank</span>
          <span className="block text-[13px] font-bold">
            #{u.globalRank.toLocaleString()}{" "}
            <span className="text-[11px] font-semibold text-emerald-400">↑ {u.rankDelta}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

export function TournamentsCard() {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[13.5px] font-bold">Join Tournaments</h2>
        <Trophy size={17} className="text-violet-400" />
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-dim">
        Compete, win prizes and climb the ranks!
      </p>
      <Link href="/tournaments" className="btn btn-violet mt-4 w-full !py-2 !text-[12px]">
        View Tournaments
      </Link>
    </div>
  );
}

export default function MainSidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <>
      <SideNav items={items} />
      <div>
        <p className="eyebrow mb-2 px-1">Your Stats</p>
        <YourStatsCard />
      </div>
      {footer ?? <TournamentsCard />}
    </>
  );
}
