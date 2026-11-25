"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Bookmark,
  Calendar,
  Clock,
  Code2,
  Eye,
  Filter,
  Gem,
  Heart,
  Lightbulb,
  MessageSquare,
  Megaphone,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Swords,
  User,
  Users,
  UsersRound,
} from "lucide-react";
import AppLayout, { SideNav, type SideItem } from "../../components/layout/AppLayout";
import { Avatar, Panel, Tag } from "../../components/ui/Bits";
import RankBadge from "../../components/ui/RankBadge";
import { onlineFriends, posts, topContributors, upcomingEvents } from "../../lib/demo";

const categories = [
  "All",
  "Discussions",
  "Tips & Solutions",
  "Looking for Opponent",
  "Showcase",
  "Announcements",
];

const communityNav: SideItem[] = [
  { href: "/community", label: "Community", icon: UsersRound },
  { href: "/community?c=discussions", label: "Discussions", icon: MessageSquare },
  { href: "/community?c=tips", label: "Tips & Solutions", icon: Lightbulb },
  { href: "/community?c=lfo", label: "Looking for Opponent", icon: Swords },
  { href: "/community?c=showcase", label: "Showcase", icon: Code2 },
  { href: "/community?c=announcements", label: "Announcements", icon: Megaphone },
];

const myStuffNav: SideItem[] = [
  { href: "/community?m=posts", label: "My Posts", icon: User },
  { href: "/community?m=bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/community?m=discussions", label: "My Discussions", icon: MessageSquare },
  { href: "/community?m=following", label: "Following", icon: Users },
];

const communityStats = [
  { icon: Users, tone: "text-blue-300", value: "12.4K", label: "Members" },
  { icon: Code2, tone: "text-emerald-300", value: "3.2K", label: "Posts" },
  { icon: MessageSquare, tone: "text-violet-300", value: "8.7K", label: "Comments" },
  { icon: Clock, tone: "text-amber", value: "24", label: "Daily Active" },
];

export default function CommunityPage() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () =>
      posts.filter(
        (p) =>
          (category === "All" || p.category === category) &&
          (p.title + p.excerpt + p.author).toLowerCase().includes(query.toLowerCase()),
      ),
    [category, query],
  );

  return (
    <AppLayout
      sidebar={
        <>
          <SideNav items={communityNav} />
          <div className="border-t border-line pt-4">
            <SideNav items={myStuffNav} heading="Your Stuff" />
          </div>
        </>
      }
      rail={
        <>
          <Panel title="Top Contributors" action={<button className="link-quiet">View Leaderboard</button>} bodyClassName="space-y-3">
            {topContributors.map((c) => (
              <div key={c.name} className="flex items-center gap-2.5">
                <RankBadge rank={c.rank} size={22} />
                <Avatar src={c.avatar} alt={c.name} size={28} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{c.name}</span>
                <Tag tone="violet">
                  <Gem size={10} /> {c.rating}
                </Tag>
                <span className="shrink-0 text-[11px] text-dim">{c.posts} posts</span>
              </div>
            ))}
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                Online Members
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span className="dot-live" /> 1248
                </span>
              </span>
            }
            action={<button className="link-quiet">View All</button>}
          >
            <div className="flex items-center">
              {onlineFriends.concat(onlineFriends.slice(0, 2)).map((f, i) => (
                <span key={`${f.name}-${i}`} className={i ? "-ml-2" : ""}>
                  <Avatar src={f.avatar} alt={f.name} size={30} ring />
                </span>
              ))}
              <span className="ml-3 rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
                +1243
              </span>
            </div>
          </Panel>

          <Panel title="Community Stats">
            <div className="grid grid-cols-2 gap-2.5">
              {communityStats.map((s) => (
                <div key={s.label} className="card-soft p-3">
                  <s.icon size={16} className={s.tone} />
                  <p className="mt-2 text-[15px] font-extrabold">{s.value}</p>
                  <p className="mt-0.5 text-[11px] text-dim">{s.label}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Upcoming Events" action={<button className="link-quiet">View All</button>} bodyClassName="space-y-2.5">
            {upcomingEvents.map((e) => (
              <div key={e.title} className="card-soft flex gap-3 p-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    e.tone === "violet" ? "border-violet/30 bg-violet/12 text-violet-300" : "border-blue/30 bg-blue/12 text-blue-300"
                  }`}
                >
                  <Calendar size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold">{e.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-dim">{e.date}</span>
                  <span className="mt-0.5 block text-[11px] text-blue-400">{e.going}</span>
                </span>
              </div>
            ))}
          </Panel>
        </>
      }
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Community 👋</h1>
          <p className="mt-1.5 text-[13px] text-dim">Learn, share and grow with developers from around the world.</p>
        </div>
        <button type="button" className="btn btn-blue !py-2.5 !text-[12.5px]">
          <Plus size={15} /> Create Post
        </button>
      </header>

      <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
              category === c ? "border-blue/40 bg-blue/12 text-blue-300" : "border-line bg-panel text-muted hover:text-fg"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts…"
            aria-label="Search posts"
            className="field !pl-9"
          />
        </div>
        <button type="button" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-4 py-2.5 text-[12.5px] font-semibold text-muted hover:text-fg">
          <Filter size={14} /> Filters
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {visible.map((p) => (
          <article key={p.title} className="card p-4">
            <header className="flex items-start gap-3">
              <Avatar src={p.avatar} alt={p.author} size={34} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold">{p.author}</span>
                  <Tag tone="violet">
                    <Gem size={10} /> {p.rating}
                  </Tag>
                </p>
                <p className="mt-0.5 text-[11.5px] text-dim">
                  {p.time} in <span className="text-blue-400">{p.category}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.pinned && (
                  <Tag tone="green">
                    <Pin size={10} /> Pinned
                  </Tag>
                )}
                <button type="button" aria-label="Bookmark post" className="text-dim hover:text-fg">
                  <Bookmark size={15} />
                </button>
                <button type="button" aria-label="More options" className="text-dim hover:text-fg">
                  <MoreHorizontal size={15} />
                </button>
              </div>
            </header>

            <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold leading-snug">{p.title}</h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">{p.excerpt}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <Tag key={t} tone="amber">
                      {t}
                    </Tag>
                  ))}
                </div>
              </div>
              {p.thumb && (
                <Image src={p.thumb} alt="" width={480} height={300} className="h-[86px] w-[150px] rounded-lg border border-line object-cover" />
              )}
            </div>

            <footer className="mt-3 flex items-center justify-end gap-4 border-t border-line/70 pt-3 text-[11.5px] text-dim">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={13} /> {p.comments}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye size={13} /> {p.views}
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <Heart size={13} fill="currentColor" strokeWidth={0} /> {p.likes}
              </span>
            </footer>
          </article>
        ))}

        {!visible.length && <p className="card p-10 text-center text-[13px] text-dim">No posts match your search yet.</p>}
      </div>
    </AppLayout>
  );
}
