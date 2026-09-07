import Image from "next/image";
import { Heart, MessageSquare, ThumbsUp } from "lucide-react";
import { Avatar, Panel, Progress, Tag } from "../ui/Bits";
import {
  communityStats,
  currentUser,
  favoriteLanguages,
  favoriteTopics,
  featuredPost,
  profileFriends,
  profileFriendsCount,
} from "../../lib/demo";

function SeasonCard() {
  const { season } = currentUser;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11.5px] text-dim">{season.endsInLabel}</p>
        <Image src="/img/season-badge.png" alt="" width={200} height={200} className="h-10 w-auto" />
      </div>
      <h2 className="mt-2 text-[15px] font-bold">{season.name}</h2>
      <p className="mt-1 text-[12px] font-semibold text-violet-300">{season.league}</p>
      <p className="mt-0.5 text-[11px] text-dim">Top {currentUser.topPercent}</p>
      <Progress value={(season.xp / season.xpGoal) * 100} className="mt-3" />
      <p className="mt-1.5 text-[11px] text-dim">
        {season.xp.toLocaleString()} / {season.xpGoal.toLocaleString()} XP
      </p>
      <button type="button" className="btn btn-violet mt-4 w-full !py-2 !text-[12px]">
        View Season
      </button>
    </div>
  );
}

export default function ProfileRail() {
  return (
    <>
      <SeasonCard />

      <Panel title="Favorite Languages & Topics" action={<button className="link-quiet">Edit</button>} bodyClassName="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {favoriteLanguages.map((l) => (
            <Tag key={l} tone="amber">
              {l}
            </Tag>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {favoriteTopics.map((t) => (
            <Tag key={t} tone="slate">
              {t}
            </Tag>
          ))}
        </div>
      </Panel>

      <Panel
        title={`Friends (${profileFriendsCount})`}
        action={<button className="link-quiet">View All</button>}
      >
        <div className="flex items-center -space-x-2.5">
          {profileFriends.map((src) => (
            <Avatar key={src} src={src} alt="" size={34} />
          ))}
          {profileFriendsCount > profileFriends.length && (
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] font-bold text-muted ring-2 ring-panel">
              +{profileFriendsCount - profileFriends.length}
            </span>
          )}
        </div>
      </Panel>

      <Panel title="Community Contribution" action={<button className="link-quiet">View All</button>} bodyClassName="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <MessageSquare size={15} className="mx-auto text-blue-300" />
            <p className="mt-1.5 text-[15px] font-bold">{communityStats.posts}</p>
            <p className="text-[10.5px] text-dim">Posts</p>
          </div>
          <div>
            <ThumbsUp size={15} className="mx-auto text-emerald-300" />
            <p className="mt-1.5 text-[15px] font-bold">{communityStats.helpfulAnswers}</p>
            <p className="text-[10.5px] text-dim">Helpful Answers</p>
          </div>
          <div>
            <Heart size={15} className="mx-auto text-rose-300" />
            <p className="mt-1.5 text-[15px] font-bold">{communityStats.likesReceived}</p>
            <p className="text-[10.5px] text-dim">Likes Received</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 border-t border-line pt-3.5">
          <Avatar src={featuredPost.avatar} alt="" size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold">{featuredPost.title}</p>
            <p className="mt-0.5 text-[11px] text-dim">{featuredPost.time}</p>
          </div>
          <span className="shrink-0 text-[11px] text-dim">
            {featuredPost.comments} · {featuredPost.likes}❤
          </span>
        </div>
      </Panel>
    </>
  );
}
