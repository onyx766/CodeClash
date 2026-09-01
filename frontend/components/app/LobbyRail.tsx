import Image from "next/image";
import { Flame, TrendingUp, Trophy, Zap } from "lucide-react";
import { Avatar, IconBadge, Panel } from "../ui/Bits";
import { onlineFriends, recentActivity } from "../../lib/demo";

const activityIcon = {
  trophy: Trophy,
  zap: Zap,
  chart: TrendingUp,
  flame: Flame,
} as const;

export default function LobbyRail() {
  return (
    <>
      <Panel
        title={
          <span className="flex items-center gap-2">
            Online Friends
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
              <span className="dot-live" />
              {onlineFriends.length + 3}
            </span>
          </span>
        }
        action={<button className="link-quiet">View All</button>}
        bodyClassName="space-y-3"
      >
        {onlineFriends.map((f) => (
          <div key={f.name} className="flex items-center gap-3">
            <Avatar src={f.avatar} alt={f.name} size={34} online />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{f.name}</span>
              <span
                className={`block text-[11px] ${
                  f.status === "In a Match" ? "text-amber" : "text-emerald-400"
                }`}
              >
                {f.status}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[12px] font-bold text-amber">
              {f.rating} <Trophy size={12} />
            </span>
          </div>
        ))}
      </Panel>

      <Panel
        title="Recent Activity"
        action={<button className="link-quiet">View All</button>}
        bodyClassName="space-y-3.5"
      >
        {recentActivity.map((a) => {
          const Icon = activityIcon[a.icon];
          return (
            <div key={a.title} className="flex items-start gap-3">
              <IconBadge tone={a.tone} size={32} rounded="rounded-lg">
                <Icon size={15} />
              </IconBadge>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold leading-snug">{a.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-dim">{a.meta}</span>
              </span>
              <span className="shrink-0 text-[10.5px] text-dim">{a.time}</span>
            </div>
          );
        })}
      </Panel>

      <section className="card relative overflow-hidden border-violet/25 bg-gradient-to-br from-[#1a1440] to-[#0f1330] p-4">
        <div className="relative z-10 max-w-[62%]">
          <h2 className="text-[14px] font-bold">Daily Bonus</h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
            Complete a match today and claim your bonus!
          </p>
          <button type="button" className="btn btn-violet mt-4 !px-4 !py-2 !text-[12px]">
            Claim Bonus
          </button>
        </div>
        <Image
          src="/img/gift.png"
          alt=""
          width={320}
          height={320}
          className="pointer-events-none absolute -right-2 bottom-0 h-[110px] w-auto"
        />
      </section>
    </>
  );
}
