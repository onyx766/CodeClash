import Link from "next/link";
import { BarChart3, Coins, Flame, Gem, LayoutGrid, Plus, Swords, Trophy, Users } from "lucide-react";
import { SideNav, type SideItem } from "../layout/AppLayout";
import { currentUser } from "../../lib/demo";

const items: SideItem[] = [
  { href: "/lobby", label: "Lobby", icon: LayoutGrid },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/how-it-works", label: "How It Works", icon: Trophy },
  { href: "/community", label: "Community", icon: Users },
];

function Sparkline() {
  return (
    <svg viewBox="0 0 120 40" className="mt-4 h-10 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="challengesSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-violet)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-violet)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 24 L12 30 L24 22 L36 34 L48 20 L60 26 L72 14 L84 18 L96 8 L108 12 L120 4 L120 40 L0 40 Z"
        fill="url(#challengesSpark)"
      />
      <path
        d="M0 24 L12 30 L24 22 L36 34 L48 20 L60 26 L72 14 L84 18 L96 8 L108 12 L120 4"
        fill="none"
        stroke="var(--color-violet)"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export default function ChallengesSidebar() {
  const u = currentUser;
  return (
    <>
      <SideNav items={items} />

      <div className="card p-5">
        <p className="eyebrow">Current Rating</p>
        <p className="mt-1.5 flex items-center gap-2 text-[28px] font-extrabold text-violet-300">
          <Gem size={22} className="text-violet-400" />
          {u.rating}
        </p>
        <p className="mt-0.5 text-[11px] text-violet-200/70">Top {u.topPercent}</p>

        <Sparkline />

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12.5px]">
          <span className="text-dim">
            Solved <span className="font-bold text-fg">{u.wins}</span>
          </span>
          <span className="text-dim">
            Win Rate <span className="font-bold text-fg">{u.winRate}%</span>
          </span>
        </div>
      </div>

      <div className="card flex items-center gap-3 p-4">
        <Flame size={22} className="text-amber shrink-0" />
        <span>
          <span className="block text-[20px] font-extrabold leading-none">
            {u.streak} <span className="text-[12px] font-normal text-dim">days</span>
          </span>
          <span className="mt-1 block text-[11px] text-dim">Best Streak</span>
        </span>
      </div>

      <div className="card flex items-center gap-3 p-4">
        <Coins size={22} className="text-amber shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-dim">Coins</span>
          <span className="block text-[20px] font-extrabold leading-none text-amber-300">2,430</span>
        </span>
        <button
          type="button"
          aria-label="Add coins"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-dim hover:text-fg"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="card p-4">
        <h2 className="text-[13.5px] font-bold">Daily Challenge</h2>
        <p className="mt-1.5 text-[11px] text-dim">
          Resets in <span className="font-semibold text-fg">12:45:30</span>
        </p>
        <Link href="/challenges" className="btn btn-violet mt-4 w-full !py-2.5 !text-[12.5px]">
          Start Daily
        </Link>
      </div>
    </>
  );
}
