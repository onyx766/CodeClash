"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Code2, Flame, Gem, Globe2, MapPin, PencilLine, Swords, Trophy } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import MainSidebar from "../../components/app/MainSidebar";
import ProfileRail from "../../components/app/ProfileRail";
import ChangePasswordPanel from "../../components/profile/ChangePasswordPanel";
import EditProfileModal from "../../components/profile/EditProfileModal";
import MatchHistoryPanel from "../../components/profile/MatchHistoryPanel";
import RatingProgressionPanel from "../../components/profile/RatingProgressionPanel";
import RecordsPanel from "../../components/profile/RecordsPanel";
import { Avatar, IconBadge, Tag, avatarForUserId } from "../../components/ui/Bits";
import useActiveMatch from "../../hooks/useActiveMatch";
import useAuth from "../../hooks/useAuth";
import useProfile from "../../hooks/useProfile";

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

export default function ProfilePage() {
  const { user } = useAuth();
  const { profileUser, stats, refetch } = useProfile();
  const [editing, setEditing] = useState(false);
  // Bumped when a match ends while the page is open, to reload the history.
  const [historyVersion, setHistoryVersion] = useState(0);

  // The provider's copy may predate the player's last match.
  useEffect(() => {
    void refetch();
  }, [refetch]);

  const onMatchEnded = useCallback(() => {
    void refetch();
    setHistoryVersion((n) => n + 1);
  }, [refetch]);
  useActiveMatch(onMatchEnded);

  const displayName = profileUser?.displayName || user?.username || "";
  const avatarSrc = profileUser?.avatarUrl || avatarForUserId(user?.id ?? "guest");
  const location =
    profileUser?.location ||
    [profileUser?.city, profileUser?.region, profileUser?.country].filter(Boolean).join(", ");

  const tiles = [
    { icon: Gem, tone: "violet", label: "Current Rating", value: stats?.rating ?? "—" },
    { icon: Globe2, tone: "blue", label: "Global Rank", value: stats ? `#${stats.globalRank.toLocaleString()}` : "—" },
    { icon: Swords, tone: "green", label: "Challenges Solved", value: stats?.challengesSolved ?? "—" },
    { icon: Flame, tone: "amber", label: "Best Win Streak", value: stats?.bestStreak ?? "—" },
  ] as const;

  return (
    <AppLayout
      sidebar={<MainSidebar />}
      rail={
        <>
          <ProfileRail onEdit={profileUser ? () => setEditing(true) : undefined} />
          <ChangePasswordPanel />
        </>
      }
    >
      {editing && <EditProfileModal onClose={() => setEditing(false)} />}

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
              {profileUser?.displayName && user?.username ? (
                <p className="mt-0.5 text-[12.5px] text-dim">@{user.username}</p>
              ) : null}
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
                <p className="mt-3 max-w-xl whitespace-pre-line text-[12.5px] leading-relaxed text-muted">
                  {profileUser.bio}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={!profileUser}
              className="btn btn-ghost !px-4 !py-2 !text-[12.5px]"
            >
              <PencilLine size={14} /> Edit Profile
            </button>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} className="card p-3.5">
            <IconBadge tone={s.tone} size={30} rounded="rounded-lg">
              <s.icon size={14} />
            </IconBadge>
            <p className="mt-2.5 text-[17px] font-extrabold leading-none">{s.value}</p>
            <p className="mt-1 text-[11px] font-semibold text-dim">{s.label}</p>
          </div>
        ))}
      </div>

      <RecordsPanel stats={stats} />

      <RatingProgressionPanel refreshKey={historyVersion} />

      <MatchHistoryPanel refreshKey={historyVersion} />
    </AppLayout>
  );
}
