"use client";

import { useEffect, useState } from "react";
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
import { Avatar, IconBadge, Panel, Tag, avatarForUserId } from "../../components/ui/Bits";
import useAuth from "../../hooks/useAuth";
import useProfile from "../../hooks/useProfile";
import { matches as matchesApi } from "../../lib/api";
import { achievements, featuredSolutions, ratingHistory } from "../../lib/demo";

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

type HistoryOpponent = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
} | null;

type HistoryMatch = {
  matchId: string;
  finishedAt: string | null;
  result: "WIN" | "LOSS" | "DRAW";
  ratingDelta: number | null;
  ratingAfter: number;
  opponent: HistoryOpponent;
};

function tierForRating(rating: number) {
  if (rating >= 2100) return "Diamond";
  if (rating >= 1800) return "Platinum";
  if (rating >= 1500) return "Gold";
  if (rating >= 1200) return "Silver";
  return "Bronze";
}

function formatJoined(iso?: string) {
  if (!iso) return "";
  return `Joined ${new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return "";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { profileUser, stats } = useProfile();
  const [history, setHistory] = useState<HistoryMatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    matchesApi
      .history(1, 10)
      .then((res: { matches: HistoryMatch[] }) => {
        if (!cancelled) setHistory(res.matches);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = profileUser?.displayName || user?.username || "";
  const avatarSrc = profileUser?.avatarUrl || avatarForUserId(user?.id ?? "guest");
  const location =
    profileUser?.location ||
    [profileUser?.city, profileUser?.region, profileUser?.country].filter(Boolean).join(", ");

  const stats7 = [
    { icon: Gem, tone: "violet", label: "Current Rating", value: stats?.rating ?? "—", sub: "" },
    {
      icon: Globe2,
      tone: "blue",
      label: "Global Rank",
      value: stats ? `#${stats.globalRank.toLocaleString()}` : "—",
      sub: "",
    },
    {
      icon: Swords,
      tone: "green",
      label: "Challenges Solved",
      value: stats?.challengesSolved ?? 0,
      sub: "",
    },
    {
      icon: Target,
      tone: "teal",
      label: "Win Rate",
      value: `${stats?.winRate ?? 0}%`,
      sub: `${stats?.wins ?? 0}W / ${stats?.losses ?? 0}L`,
    },
    { icon: Flame, tone: "amber", label: "Best Streak", value: stats?.bestStreak ?? 0, sub: "Matches" },
    { icon: Gamepad2, tone: "rose", label: "Total Matches", value: stats?.matchesPlayed ?? 0, sub: "" },
    { icon: Coins, tone: "amber", label: "Coins", value: (stats?.coins ?? 0).toLocaleString(), sub: "" },
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
            <Avatar src={avatarSrc} alt={displayName} size={96} ring />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">{displayName}</h1>
                {stats ? <Tag tone="violet">{tierForRating(stats.rating)}</Tag> : null}
              </div>
              {stats ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[14px] font-bold text-amber">
                  <Trophy size={14} /> {stats.rating}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-dim">
                {location ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={12} /> {location}
                  </span>
                ) : null}
                {profileUser?.joinedAt ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} /> {formatJoined(profileUser.joinedAt)}
                  </span>
                ) : null}
              </div>
              {profileUser?.bio ? (
                <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-muted">{profileUser.bio}</p>
              ) : null}
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
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {stats7.map((s) => (
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
        {history.length === 0 ? (
          <p className="px-4 py-6 text-[12.5px] text-dim">No finished matches yet.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {history.map((m) => {
              const opponentName = m.opponent?.displayName || m.opponent?.username || "Unknown";
              const opponentAvatar =
                m.opponent?.avatarUrl || avatarForUserId(m.opponent?.id ?? m.matchId);
              const resultLabel = m.result === "WIN" ? "Victory" : m.result === "LOSS" ? "Defeat" : "Draw";
              return (
                <li key={m.matchId} className="flex items-center gap-3 px-4 py-3">
                  <Tag
                    tone={m.result === "WIN" ? "green" : m.result === "LOSS" ? "rose" : "slate"}
                    className="w-[58px] justify-center"
                  >
                    {resultLabel}
                  </Tag>
                  <Avatar src={opponentAvatar} alt={opponentName} size={30} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">vs {opponentName}</span>
                  {m.ratingDelta !== null ? (
                    <span
                      className={`text-[12.5px] font-bold ${m.ratingDelta > 0 ? "text-emerald-400" : "text-rose-400"}`}
                    >
                      {m.ratingDelta > 0 ? "+" : ""}
                      {m.ratingDelta}
                    </span>
                  ) : (
                    <span className="text-[11px] text-dim">Casual</span>
                  )}
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-amber">
                    <Trophy size={11} /> {m.ratingAfter}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11px] text-dim">
                    {formatRelativeTime(m.finishedAt)}
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-dim" />
                </li>
              );
            })}
          </ul>
        )}
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
