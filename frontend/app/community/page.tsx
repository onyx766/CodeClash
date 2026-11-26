"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Eye, Gem, Heart, Info, MessageSquare, Pin, Search } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import MainSidebar from "../../components/app/MainSidebar";
import TopPlayersPanel from "../../components/app/TopPlayersPanel";
import { Avatar, Tag } from "../../components/ui/Bits";
import { posts } from "../../lib/demo";

const categories = [
  "All",
  "Discussions",
  "Tips & Solutions",
  "Looking for Opponent",
  "Showcase",
  "Announcements",
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
    <AppLayout sidebar={<MainSidebar />} rail={<TopPlayersPanel />}>
      <header>
        <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Community 👋</h1>
        <p className="mt-1.5 text-[13px] text-dim">Learn, share and grow with developers from around the world.</p>
      </header>

      <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-blue/30 bg-blue/10 px-4 py-3 text-[12.5px] leading-relaxed text-blue-100">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-300" />
        <span>
          Community posts are coming soon. The posts below are examples of what you will be able to share; they are
          not real discussions yet.
        </span>
      </p>

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

      <div className="relative mt-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search example posts…"
          aria-label="Search posts"
          className="field !pl-9"
        />
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
                <Tag tone="slate">Example</Tag>
                {p.pinned && (
                  <Tag tone="green">
                    <Pin size={10} /> Pinned
                  </Tag>
                )}
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
