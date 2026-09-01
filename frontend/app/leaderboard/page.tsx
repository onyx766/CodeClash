"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ChevronDown, ChevronRight, Flame, Gem } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import MainSidebar from "../../components/app/MainSidebar";
import RankBadge from "../../components/ui/RankBadge";
import { Avatar, Panel, Progress, Tag } from "../../components/ui/Bits";
import {
  currentUser,
  leaderboard,
  recentWinners,
  topWeekly,
} from "../../lib/demo";

const tabs = ["Global", "Weekly", "Monthly", "Friends"];

const tierTone: Record<string, string> = {
  Pro: "violet",
  Expert: "blue",
  Advanced: "teal",
};

function SeasonCard() {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13.5px] font-bold">Season 1</h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-dim">
            Ends in 24d 12h 45m
          </p>
        </div>
        <Image src="/img/season-badge.png" alt="" width={200} height={200} className="h-12 w-auto" />
      </div>
      <button type="button" className="btn btn-violet mt-4 w-full !py-2 !text-[12px]">
        View Season
      </button>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState("Global");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    if (tab === "Weekly") return [...leaderboard].sort((a, b) => b.streak - a.streak);
    if (tab === "Monthly") return [...leaderboard].sort((a, b) => b.wins - a.wins);
    if (tab === "Friends") return leaderboard.slice(0, 5);
    return leaderboard;
  }, [tab]);

  return (
    <AppLayout
      sidebar={<MainSidebar footer={<SeasonCard />} />}
      rail={
        <>
          <Panel
            title="Top Players This Week"
            action={<button className="link-quiet">View All</button>}
            bodyClassName="space-y-3"
          >
            {topWeekly.map((p) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <RankBadge rank={p.rank} />
                <Avatar src={p.avatar} alt={p.name} size={30} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.name}</span>
                <span className="flex items-center gap-1 text-[12px] font-bold text-violet-300">
                  <Gem size={11} />
                  {p.rating}
                </span>
                <span className="text-[11.5px] font-semibold text-emerald-400">↑ {p.delta}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Your Rank">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet/35 bg-violet/12 text-violet-300">
                  <Gem size={16} />
                </span>
                <span>
                  <span className="block text-[20px] font-extrabold leading-none">
                    #{currentUser.globalRank.toLocaleString()}
                  </span>
                  <span className="mt-1 block text-[11px] text-dim">
                    Top {currentUser.topPercent}
                  </span>
                </span>
              </div>
              <div className="text-right">
                <p className="eyebrow">Rating</p>
                <p className="text-[17px] font-extrabold text-violet-300">{currentUser.rating}</p>
                <p className="text-[11.5px] font-semibold text-emerald-400">
                  ↑ {currentUser.rankDelta}
                </p>
              </div>
            </div>
            <svg viewBox="0 0 240 60" className="mt-4 h-16 w-full" aria-hidden="true">
              <defs>
                <linearGradient id="rankArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-violet)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--color-violet)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 52 L30 46 L60 48 L90 34 L120 38 L150 24 L180 26 L210 12 L240 8 L240 60 L0 60 Z"
                fill="url(#rankArea)"
              />
              <path
                d="M0 52 L30 46 L60 48 L90 34 L120 38 L150 24 L180 26 L210 12 L240 8"
                fill="none"
                stroke="var(--color-violet)"
                strokeWidth="2"
              />
            </svg>
            <p className="mt-2 text-[11.5px] text-dim">Keep competing to climb higher!</p>
          </Panel>

          <Panel
            title="Recent Winners"
            action={<button className="link-quiet">View All</button>}
            bodyClassName="space-y-3"
          >
            {recentWinners.map((w) => (
              <div key={w.text} className="flex items-center gap-2.5">
                <Avatar src={w.avatar} alt="" size={26} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{w.text}</span>
                <span className="shrink-0 text-[10.5px] text-dim">{w.time}</span>
              </div>
            ))}
          </Panel>

          <section className="card relative overflow-hidden border-blue/25 bg-gradient-to-br from-[#101a3a] to-[#0b1020] p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[13.5px] font-bold">Season Rewards</h2>
              <button className="link-quiet">View Rewards</button>
            </div>
            <p className="mt-2 max-w-[58%] text-[11.5px] leading-relaxed text-muted">
              Compete in matches to earn exclusive rewards!
            </p>
            <Progress value={69} className="mt-4 max-w-[58%]" />
            <p className="mt-2 text-[11px] text-dim">3,450 / 5,000 XP</p>
            <Image
              src="/img/chest.png"
              alt=""
              width={320}
              height={320}
              className="pointer-events-none absolute -right-1 bottom-1 h-[104px] w-auto"
            />
          </section>
        </>
      }
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Image src="/img/trophy-purple.png" alt="" width={200} height={200} className="h-9 w-auto" />
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Leaderboard</h1>
            <p className="mt-1 text-[13px] text-dim">Top developers from around the world</p>
          </div>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-[12.5px] font-semibold">
            <span className="dot-live" /> Season 1
          </p>
          <p className="mt-1 text-[11.5px] text-dim">Ends in 24d 12h 45m</p>
        </div>
      </header>

      <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-lg border px-4 py-2 text-[12.5px] font-semibold transition-colors ${
              tab === t
                ? "border-blue/40 bg-blue/12 text-blue-300"
                : "border-line bg-panel text-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-4 py-2 text-[12.5px] font-semibold text-muted hover:text-fg"
        >
          Country <ChevronDown size={14} />
        </button>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[11.5px] text-dim">
                <th className="w-12 px-4 py-3 font-semibold">#</th>
                <th className="px-2 py-3 font-semibold">Player</th>
                <th className="px-2 py-3 font-semibold text-blue-300">
                  <span className="inline-flex items-center gap-1">
                    Rating <ArrowDown size={12} />
                  </span>
                </th>
                <th className="px-2 py-3 font-semibold">Wins</th>
                <th className="px-2 py-3 font-semibold">Win Rate</th>
                <th className="px-2 py-3 font-semibold">Top Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.name}
                  className={`border-b border-line/60 last:border-0 transition-colors hover:bg-white/[0.03] ${
                    i === 0 ? "bg-amber/[0.06] shadow-[inset_3px_0_0_0_var(--color-amber)]" : ""
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <RankBadge rank={i + 1} />
                  </td>
                  <td className="px-2 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar src={r.avatar} alt={r.name} size={34} online />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-semibold">{r.name}</span>
                          <Tag tone={tierTone[r.tier]}>{r.tier}</Tag>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-dim">
                          {r.flag} {r.country}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-violet-300">
                      <Gem size={13} /> {r.rating}
                    </span>
                  </td>
                  <td className="px-2 py-3.5 text-[13px] font-semibold text-emerald-300">
                    {r.wins}
                  </td>
                  <td className="px-2 py-3.5 text-[13px] font-semibold">{r.winRate}</td>
                  <td className="px-2 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber">
                      <Flame size={13} /> {r.streak}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3.5">
          <p className="text-[12px] text-dim">Showing Top 100</p>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`h-8 w-8 rounded-lg text-[12.5px] font-semibold transition-colors ${
                  page === p
                    ? "bg-blue text-white"
                    : "border border-line bg-panel text-muted hover:text-fg"
                }`}
              >
                {p}
              </button>
            ))}
            <span className="px-1 text-[12.5px] text-dim">…</span>
            <button
              type="button"
              onClick={() => setPage(10)}
              className={`h-8 w-8 rounded-lg text-[12.5px] font-semibold transition-colors ${
                page === 10
                  ? "bg-blue text-white"
                  : "border border-line bg-panel text-muted hover:text-fg"
              }`}
            >
              10
            </button>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setPage((p) => Math.min(10, p + 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-muted hover:text-fg"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
