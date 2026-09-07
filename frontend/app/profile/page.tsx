"use client";

import {
  BarChart3,
  Calendar,
  ChevronRight,
  Code2,
  Coins,
  Compass,
  Crown,
  Eye,
  FileText,
  Flame,
  Gamepad2,
  Gem,
  Globe2,
  Heart,
  MapPin,
  PencilLine,
  Share2,
  Swords,
  Target,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import MainSidebar from "../../components/app/MainSidebar";
import ProfileRail from "../../components/app/ProfileRail";
import RatingLineChart from "../../components/charts/RatingLineChart";
import { Avatar, IconBadge, Panel, Tag } from "../../components/ui/Bits";
import useAuth from "../../hooks/useAuth";
import {
  achievements,
  currentUser,
  featuredSolutions,
  profileMatches,
  ratingHistory,
} from "../../lib/demo";

const achievementIcon: Record<string, LucideIcon> = {
  code: Code2,
  flame: Flame,
  zap: Zap,
  trophy: Trophy,
  users: Users,
  compass: Compass,
  calendar: Calendar,
  crown: Crown,
};

const solutionIcon: Record<string, LucideIcon> = {
  share: Share2,
  doc: FileText,
  chart: BarChart3,
};

export default function ProfilePage() {
  const { user } = useAuth();
  const displayName = user?.username ?? currentUser.name;

  const stats = [
    { icon: Gem, tone: "violet", label: "Current Rating", value: currentUser.rating, sub: `Top ${currentUser.topPercent}` },
    { icon: Globe2, tone: "blue", label: "Global Rank", value: `#${currentUser.globalRank.toLocaleString()}`, sub: `Top ${currentUser.topPercent}` },
    { icon: Swords, tone: "green", label: "Challenges Solved", value: currentUser.challengesSolved, sub: `of ${currentUser.challengesTotal}` },
    { icon: Target, tone: "teal", label: "Win Rate", value: `${currentUser.winRate}%`, sub: `${currentUser.wins}W / ${currentUser.losses}L` },
    { icon: Flame, tone: "amber", label: "Best Streak", value: currentUser.streak, sub: "Matches" },
    { icon: Gamepad2, tone: "rose", label: "Total Matches", value: currentUser.totalMatches, sub: "" },
    { icon: Coins, tone: "amber", label: "Coins", value: currentUser.coins.toLocaleString(), sub: "" },
  ] as const;

  return (
    <AppLayout sidebar={<MainSidebar />} rail={<ProfileRail />}>
      <section className="card relative overflow-hidden p-5 sm:p-6">
        <Code2
          size={64}
          strokeWidth={1.5}
          className="pointer-events-none absolute right-6 top-24 hidden text-violet-400/15 sm:block"
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar src={currentUser.avatar} alt={displayName} size={96} ring />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">{displayName}</h1>
                <Tag tone="violet">{currentUser.tier}</Tag>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-[14px] font-bold text-amber">
                <Trophy size={14} /> {currentUser.rating}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-dim">
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} /> {currentUser.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} /> {currentUser.joinedLabel}
                </span>
              </div>
              <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-muted">{currentUser.bio}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className="btn btn-ghost !px-4 !py-2 !text-[12.5px]">
              <PencilLine size={14} /> Edit Profile
            </button>
            <button type="button" className="btn btn-blue !px-4 !py-2 !text-[12.5px]">
              <Share2 size={14} /> Share Profile
            </button>
          </div>
        </div>

        <blockquote className="relative z-10 mt-5 max-w-sm border-l-2 border-violet/40 pl-3 text-[12.5px] italic leading-relaxed text-muted">
          &ldquo;{currentUser.quote}&rdquo;
        </blockquote>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className="card p-3.5">
            <IconBadge tone={s.tone} size={30} rounded="rounded-lg">
              <s.icon size={14} />
            </IconBadge>
            <p className="mt-2.5 text-[17px] font-extrabold leading-none">{s.value}</p>
            <p className="mt-1 text-[11px] font-semibold text-dim">{s.label}</p>
            {s.sub && <p className="mt-0.5 text-[10.5px] text-dim">{s.sub}</p>}
          </div>
        ))}
      </div>

      <Panel
        title="Rating Progression"
        action={
          <button type="button" className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-muted">
            Last 30 Days
          </button>
        }
        className="mt-4"
      >
        <RatingLineChart data={[...ratingHistory]} />
      </Panel>

      <Panel
        title="Achievements"
        action={<button className="link-quiet">View All</button>}
        className="mt-4"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {achievements.map((a) => {
            const Icon = achievementIcon[a.icon];
            return (
              <div key={a.title} className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white/[0.02] p-3.5 text-center">
                <IconBadge tone={a.tone} size={42}>
                  <Icon size={19} />
                </IconBadge>
                <p className="text-[12.5px] font-bold leading-tight">{a.title}</p>
                <p className="text-[10.5px] text-dim">{a.subtitle}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Recent Matches"
        action={<button className="link-quiet">View All</button>}
        className="mt-4"
        bodyClassName="!px-0 !pb-0"
      >
        <ul className="divide-y divide-line/70">
          {profileMatches.map((m) => (
            <li key={`${m.opponent}-${m.time}`} className="flex items-center gap-3 px-4 py-3">
              <Tag tone={m.result === "Victory" ? "green" : "rose"} className="w-[58px] justify-center">
                {m.result}
              </Tag>
              <Avatar src={m.avatar} alt={m.opponent} size={30} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">vs {m.opponent}</span>
              <span className={`text-[12.5px] font-bold ${m.delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {m.delta > 0 ? "+" : ""}
                {m.delta}
              </span>
              <span className="flex items-center gap-1 text-[12px] font-semibold text-amber">
                <Trophy size={11} /> {m.rating}
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] text-dim">{m.time}</span>
              <ChevronRight size={15} className="shrink-0 text-dim" />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Featured Solutions & Projects"
        action={<button className="link-quiet">View All</button>}
        className="mt-4 mb-2"
        bodyClassName="space-y-2.5"
      >
        {featuredSolutions.map((f) => {
          const Icon = solutionIcon[f.icon];
          return (
            <div key={f.title} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
              <IconBadge tone="violet" size={38} rounded="rounded-lg">
                <Icon size={17} />
              </IconBadge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{f.title}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-dim">{f.desc}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-dim">
                <Eye size={13} /> {f.views}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-dim">
                <Heart size={13} /> {f.likes}
              </span>
            </div>
          );
        })}
      </Panel>
    </AppLayout>
  );
}
