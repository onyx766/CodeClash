"use client";

import Link from "next/link";
import { ArrowRight, Gem } from "lucide-react";
import { Avatar, avatarForUserId } from "../ui/Bits";
import RankBadge from "../ui/RankBadge";
import useLeaderboard, { formatWinRate } from "../../hooks/useLeaderboard";

const PREVIEW_SIZE = 5;

export default function LeaderboardPreview() {
  const { entries, failed, loading, reload } = useLeaderboard(PREVIEW_SIZE);

  return (
    <section className="cc-container py-8">
      <div className="card grid gap-8 p-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:p-8">
        <div className="lg:pr-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-400">
            Top Developers
          </p>
          <h2 className="mt-3 text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-tight tracking-[-0.025em]">
            Climb the
            <br />
            Leaderboard
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-dim">
            Win ranked Quick Matches, earn rating points, and become the best.
          </p>
          <Link href="/leaderboard" className="btn btn-ghost mt-6">
            View Full Leaderboard <ArrowRight size={15} />
          </Link>
        </div>

        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr className="text-left text-[11.5px] font-semibold text-dim">
                <th className="w-10 pb-3 font-semibold">#</th>
                <th className="pb-3 font-semibold">Player</th>
                <th className="pb-3 text-center font-semibold text-violet-300">Rating</th>
                <th className="pb-3 text-center font-semibold">W / L</th>
                <th className="pb-3 text-center font-semibold">Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: PREVIEW_SIZE }, (_, i) => (
                  <tr key={i} className="border-t border-line/70" aria-hidden="true">
                    <td colSpan={5} className="py-2.5">
                      <div className="h-[30px] animate-pulse rounded-lg bg-white/[0.04]" />
                    </td>
                  </tr>
                ))}
              {!loading && (failed || !entries?.length) && (
                <tr className="border-t border-line/70">
                  <td colSpan={5} className="py-8 text-center text-[13px] text-dim">
                    {failed ? (
                      <>
                        The leaderboard is unavailable right now.{" "}
                        <button type="button" onClick={reload} className="link-quiet">
                          Try again
                        </button>
                      </>
                    ) : (
                      "No ranked players yet. Win a Quick Match to be the first."
                    )}
                  </td>
                </tr>
              )}
              {!loading &&
                !failed &&
                entries?.map((row) => {
                  const name = row.displayName || row.username;
                  return (
                    <tr key={row.id} className="border-t border-line/70">
                      <td className="py-2.5">
                        <RankBadge rank={row.rank} />
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={row.avatarUrl || avatarForUserId(row.id)} alt={name} size={30} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold">{name}</p>
                            {row.displayName && (
                              <p className="mt-0.5 truncate text-[11px] text-dim">@{row.username}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-violet-300">
                          <Gem size={13} strokeWidth={2.2} />
                          {row.rating}
                        </span>
                      </td>
                      <td className="py-2.5 text-center text-[13px] font-semibold">
                        <span className="text-emerald-400">{row.wins}</span>
                        <span className="text-dim"> / </span>
                        <span className="text-rose-300">{row.losses}</span>
                      </td>
                      <td className="py-2.5 text-center text-[13px] font-semibold">
                        {formatWinRate(row.wins, row.matchesPlayed)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
