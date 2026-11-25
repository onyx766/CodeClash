"use client";

import Image from "next/image";
import Link from "next/link";
import { Gem, RotateCcw, Swords, Trophy } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import MainSidebar from "../../components/app/MainSidebar";
import RankBadge from "../../components/ui/RankBadge";
import { Avatar, Panel, Tag, avatarForUserId } from "../../components/ui/Bits";
import useAuth from "../../hooks/useAuth";
import useProfile from "../../hooks/useProfile";
import useLeaderboard, { formatWinRate } from "../../hooks/useLeaderboard";
import { authHref } from "../../lib/navigation";

// The most the API serves in one list.
const LIMIT = 100;

function RankedPlayCard() {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[13.5px] font-bold">Climb the Ranks</h2>
        <Swords size={17} className="text-violet-400" />
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-dim">
        Quick Match pairs you with a player near your rating. Win ranked battles to move up.
      </p>
      <Link href="/lobby" className="btn btn-violet mt-4 w-full !py-2 !text-[12px]">
        Find a Match
      </Link>
    </div>
  );
}

function YourRank() {
  const { user, loading } = useAuth();
  const { profileUser, stats } = useProfile();

  if (loading) {
    return (
      <Panel title="Your Rank">
        <p className="text-[12px] text-dim">Loading…</p>
      </Panel>
    );
  }

  if (!user) {
    return (
      <Panel title="Your Rank">
        <p className="text-[12.5px] leading-relaxed text-dim">Sign in to see where you stand among ranked players.</p>
        <div className="mt-4 flex gap-2">
          <Link href={authHref("/login", "/leaderboard")} className="btn btn-blue flex-1 !py-2 !text-[12px]">
            Log in
          </Link>
          <Link href={authHref("/register", "/leaderboard")} className="btn btn-ghost flex-1 !py-2 !text-[12px]">
            Sign up
          </Link>
        </div>
      </Panel>
    );
  }

  // The standings only list player accounts.
  if (profileUser && profileUser.role !== "USER") {
    return (
      <Panel title="Your Rank">
        <p className="text-[12.5px] leading-relaxed text-dim">Staff accounts are not ranked.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Your Rank">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet/35 bg-violet/12 text-violet-300">
            <Trophy size={16} />
          </span>
          <span>
            <span className="block text-[20px] font-extrabold leading-none">
              {stats ? `#${stats.globalRank.toLocaleString()}` : "—"}
            </span>
            <span className="mt-1 block text-[11px] text-dim">Global rank</span>
          </span>
        </div>
        <div className="text-right">
          <p className="eyebrow">Rating</p>
          <p className="text-[17px] font-extrabold text-violet-300">{stats?.rating ?? "—"}</p>
        </div>
      </div>

      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          {[
            { label: "Wins", value: stats.wins },
            { label: "Losses", value: stats.losses },
            { label: "Win Rate", value: formatWinRate(stats.wins, stats.matchesPlayed) },
          ].map((s) => (
            <div key={s.label}>
              <p className="eyebrow !text-[9.5px]">{s.label}</p>
              <p className="mt-1 text-[14px] font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-dim">
        {stats && stats.matchesPlayed === 0
          ? "You haven't played a ranked match yet. Win a Quick Match to start climbing."
          : "Keep winning Quick Matches to climb higher."}
      </p>
    </Panel>
  );
}

function HowRankingWorks() {
  return (
    <Panel title="How Ranking Works" bodyClassName="space-y-2.5 text-[12px] leading-relaxed text-dim">
      <p>
        Only ranked <span className="font-semibold text-fg">Quick Match</span> battles change your rating, wins and
        losses. Private rooms are casual and never affect the leaderboard.
      </p>
      <p>Ratings use the Elo system: beating a higher-rated opponent earns you more points.</p>
    </Panel>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { entries, failed, loading, reload } = useLeaderboard(LIMIT);

  return (
    <AppLayout
      sidebar={<MainSidebar footer={<RankedPlayCard />} />}
      rail={
        <>
          <YourRank />
          <HowRankingWorks />
        </>
      }
    >
      <header className="flex items-start gap-3">
        <Image src="/img/trophy-purple.png" alt="" width={200} height={200} className="h-9 w-auto" />
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Leaderboard</h1>
          <p className="mt-1 text-[13px] text-dim">Ranked standings from Quick Match battles</p>
        </div>
      </header>

      <section className="card mt-5 overflow-hidden">
        {loading ? (
          <p className="px-4 py-12 text-center text-[13px] text-dim">Loading standings…</p>
        ) : failed ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[13px] text-muted">The leaderboard could not be loaded.</p>
            <button type="button" onClick={reload} className="btn btn-ghost mt-4 !py-2 !text-[12.5px]">
              <RotateCcw size={14} /> Try again
            </button>
          </div>
        ) : !entries?.length ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[14px] font-semibold">No ranked players yet</p>
            <p className="mt-1.5 text-[12.5px] text-dim">Win a Quick Match to claim the top spot.</p>
            <Link href="/lobby" className="btn btn-blue mt-4 !py-2 !text-[12.5px]">
              Find a Match
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[11.5px] text-dim">
                    <th className="w-12 px-4 py-3 font-semibold">#</th>
                    <th className="px-2 py-3 font-semibold">Player</th>
                    <th className="px-2 py-3 font-semibold text-blue-300">Rating</th>
                    <th className="px-2 py-3 font-semibold">W / L</th>
                    <th className="px-2 py-3 font-semibold">Win Rate</th>
                    <th className="px-2 py-3 font-semibold">Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const name = entry.displayName || entry.username;
                    const isMe = entry.id === user?.id;
                    return (
                      <tr
                        key={entry.id}
                        className={`border-b border-line/60 last:border-0 transition-colors hover:bg-white/[0.03] ${
                          i === 0
                            ? "bg-amber/[0.06] shadow-[inset_3px_0_0_0_var(--color-amber)]"
                            : isMe
                              ? "bg-blue/[0.06] shadow-[inset_3px_0_0_0_var(--color-blue)]"
                              : ""
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <RankBadge rank={entry.rank} />
                        </td>
                        <td className="px-2 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar src={entry.avatarUrl || avatarForUserId(entry.id)} alt={name} size={34} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-[13.5px] font-semibold">{name}</span>
                                {isMe && <Tag tone="blue">You</Tag>}
                              </span>
                              {entry.displayName && (
                                <span className="mt-0.5 block truncate text-[11px] text-dim">@{entry.username}</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-violet-300">
                            <Gem size={13} /> {entry.rating}
                          </span>
                        </td>
                        <td className="px-2 py-3.5 text-[13px] font-semibold">
                          <span className="text-emerald-300">{entry.wins}</span>
                          <span className="text-dim"> / </span>
                          <span className="text-rose-300">{entry.losses}</span>
                        </td>
                        <td className="px-2 py-3.5 text-[13px] font-semibold">
                          {formatWinRate(entry.wins, entry.matchesPlayed)}
                        </td>
                        <td className="px-2 py-3.5 text-[13px] text-muted">{entry.matchesPlayed}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="border-t border-line px-4 py-3.5 text-[12px] text-dim">
              {entries.length >= LIMIT
                ? `Showing the top ${LIMIT} players`
                : `${entries.length} ranked ${entries.length === 1 ? "player" : "players"}`}
            </p>
          </>
        )}
      </section>
    </AppLayout>
  );
}
