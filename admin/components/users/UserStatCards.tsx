"use client";

import { Card, cx } from "../ui/Primitives";
import { IconBan, IconCheckCircle, IconUserPlus, IconUsers } from "../ui/Icons";
import { formatNumber } from "../../lib/format";
import type { UserStatCard, UserStats } from "../../lib/types";

/**
 * The four counters above the table. Every number comes from
 * GET /api/admin/users/stats; nothing here is derived from the visible page.
 */
export function UserStatCards({
  stats,
  loading,
}: {
  stats: UserStats | null;
  loading: boolean;
}) {
  const cards = [
    {
      key: "total",
      label: "Total Users",
      data: stats?.total,
      icon: IconUsers,
      tone: "blue" as const,
      // A rise in total accounts is good; a rise in bans is not.
      positiveIsGood: true,
    },
    {
      key: "active",
      label: "Active Users",
      data: stats?.active,
      icon: IconCheckCircle,
      tone: "green" as const,
      positiveIsGood: true,
    },
    {
      key: "new",
      label: "New Users (30d)",
      data: stats?.newUsers,
      icon: IconUserPlus,
      tone: "violet" as const,
      positiveIsGood: true,
    },
    {
      key: "banned",
      label: "Banned Users",
      data: stats?.banned,
      icon: IconBan,
      tone: "rose" as const,
      positiveIsGood: false,
    },
  ];

  const tones = {
    blue: "border-blue/25 from-blue/20 to-blue/5 text-blue-soft",
    green: "border-green/25 from-green/20 to-green/5 text-emerald-300",
    violet: "border-violet/25 from-violet/20 to-violet/5 text-violet-300",
    rose: "border-rose/25 from-rose/20 to-rose/5 text-rose-300",
  } as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-muted">{card.label}</p>
                <p className="mt-1.5 text-[26px] leading-none font-bold tracking-tight">
                  {loading || !card.data ? (
                    <span className="text-dim">—</span>
                  ) : (
                    formatNumber(card.data.value)
                  )}
                </p>
              </div>
              <span
                className={cx(
                  "grid size-10 shrink-0 place-items-center rounded-xl border bg-gradient-to-br",
                  tones[card.tone],
                )}
              >
                <Icon size={19} />
              </span>
            </div>
            <Delta data={card.data} positiveIsGood={card.positiveIsGood} />
          </Card>
        );
      })}
    </div>
  );
}

function Delta({
  data,
  positiveIsGood,
}: {
  data?: UserStatCard;
  positiveIsGood: boolean;
}) {
  if (!data) return <p className="mt-2 h-8" />;

  const { percentChange, changeThisMonth } = data;
  const rising = changeThisMonth > 0;
  const flat = changeThisMonth === 0;
  const good = flat ? null : rising === positiveIsGood;

  return (
    <div className="mt-2">
      <p
        className={cx(
          "flex items-center gap-1 text-[12px] font-semibold",
          good === null ? "text-dim" : good ? "text-emerald-400" : "text-rose-400",
        )}
      >
        {percentChange === null ? (
          // No prior period to compare against - saying "+100%" would be a lie.
          <span className="text-dim">No prior period</span>
        ) : (
          <>
            <span aria-hidden="true">{percentChange >= 0 ? "↑" : "↓"}</span>
            {Math.abs(percentChange)}%
          </>
        )}
      </p>
      <p className="mt-0.5 text-[11.5px] text-dim">
        {changeThisMonth >= 0 ? "+" : ""}
        {formatNumber(changeThisMonth)} this month
      </p>
    </div>
  );
}
