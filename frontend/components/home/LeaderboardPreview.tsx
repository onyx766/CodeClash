import Link from "next/link";
import { ArrowRight, Flame, Gem } from "lucide-react";
import { leaderboard } from "../../lib/demo";
import { Avatar, Tag } from "../ui/Bits";
import RankBadge from "../ui/RankBadge";

const tierTone: Record<string, string> = {
  Pro: "violet",
  Expert: "blue",
  Advanced: "teal",
};

export default function LeaderboardPreview() {
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
            Compete, earn rating points, and become the best.
          </p>
          <Link href="/leaderboard" className="btn btn-ghost mt-6">
            View Full Leaderboard <ArrowRight size={15} />
          </Link>
        </div>

        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="text-left text-[11.5px] font-semibold text-dim">
                <th className="w-10 pb-3 font-semibold">#</th>
                <th className="pb-3 font-semibold">Player</th>
                <th className="pb-3 text-center font-semibold text-violet-300">Rating</th>
                <th className="pb-3 text-center font-semibold">Wins</th>
                <th className="pb-3 text-center font-semibold">Win Rate</th>
                <th className="pb-3 text-center font-semibold">Top Streak</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 5).map((row) => (
                <tr key={row.rank} className="border-t border-line/70">
                  <td className="py-2.5">
                    <RankBadge rank={row.rank} />
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={row.avatar} alt={row.name} size={30} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">{row.name}</span>
                          <Tag tone={tierTone[row.tier]}>{row.tier}</Tag>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-dim">
                          {row.flag} {row.country}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-violet-300">
                      <Gem size={13} strokeWidth={2.2} />
                      {row.rating}
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-[13px] font-semibold text-emerald-400">
                    {row.wins}
                  </td>
                  <td className="py-2.5 text-center text-[13px] font-semibold">{row.winRate}</td>
                  <td className="py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-amber">
                      <Flame size={13} strokeWidth={2.2} />
                      {row.streak}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
