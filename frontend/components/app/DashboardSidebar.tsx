import Link from "next/link";
import { ChevronRight, Flame, Gem, History, LayoutGrid, Settings, Swords, Trophy, Users } from "lucide-react";
import { SideNav, type SideItem } from "../layout/AppLayout";
import { Progress } from "../ui/Bits";
import { currentUser } from "../../lib/demo";

const items: SideItem[] = [
  { href: "/lobby", label: "Lobby", icon: LayoutGrid },
  { href: "/rooms", label: "Rooms", icon: Swords },
  { href: "/match-history", label: "Match History", icon: History },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/tournaments", label: "Tournaments", icon: Trophy, badge: "NEW" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardSidebar() {
  const u = currentUser;
  return (
    <>
      <SideNav items={items} />

      <div className="px-1">
        <div className="flex items-center justify-between text-[12.5px] font-semibold">
          <span>Level {u.level}</span>
        </div>
        <Progress value={(u.xp / u.xpGoal) * 100} className="mt-2" />
        <p className="mt-1.5 text-[11px] text-dim">
          {u.xp.toLocaleString()} / {u.xpGoal.toLocaleString()} XP
        </p>
      </div>

      <div className="card p-4 text-center">
        <p className="eyebrow">Current Rating</p>
        <p className="mt-2 flex items-center justify-center gap-2 text-[26px] font-extrabold text-violet-300">
          <Gem size={20} className="text-violet-400" />
          {u.rating}
        </p>
        <p className="mt-1 text-[11px] text-dim">Top {u.topPercent}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
          {[
            { label: "Wins", value: u.wins, tone: "text-fg" },
            { label: "Losses", value: u.losses, tone: "text-fg" },
            { label: "Win Rate", value: `${u.winRate}%`, tone: "text-emerald-300" },
          ].map((s) => (
            <div key={s.label}>
              <p className="eyebrow !text-[9.5px]">{s.label}</p>
              <p className={`mt-1 text-[15px] font-bold ${s.tone}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/leaderboard"
        className="card flex items-center gap-3 p-4 transition-colors hover:border-amber/40"
      >
        <Flame size={20} className="text-amber" />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-extrabold leading-none">{u.streak}</span>
          <span className="mt-1 block text-[11px] text-dim">Win Streak</span>
        </span>
        <ChevronRight size={16} className="text-dim" />
      </Link>
    </>
  );
}
