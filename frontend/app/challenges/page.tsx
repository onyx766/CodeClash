"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Code2,
  Coins,
  Crown,
  Flame,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import ChallengesSidebar from "../../components/app/ChallengesSidebar";
import ChallengesRail from "../../components/app/ChallengesRail";
import { IconBadge, Tag } from "../../components/ui/Bits";

const filters = ["All", "Easy", "Medium", "Hard", "Expert"] as const;

type Difficulty = (typeof filters)[number];

const difficultyMeta: Record<
  Exclude<Difficulty, "All">,
  { tone: string; border: string; iconColor: string; icon: typeof ShieldCheck }
> = {
  Easy: { tone: "green", border: "border-l-green", iconColor: "text-emerald-400", icon: ShieldCheck },
  Medium: { tone: "amber", border: "border-l-amber", iconColor: "text-amber", icon: ShieldCheck },
  Hard: { tone: "rose", border: "border-l-rose", iconColor: "text-rose-400", icon: ShieldAlert },
  Expert: { tone: "violet", border: "border-l-violet", iconColor: "text-violet-300", icon: Crown },
};

const challenges = [
  {
    id: 101,
    title: "Two Sum",
    diff: "Easy",
    tags: ["Array", "Hash Table"],
    acceptance: "89.3%",
    trophy: 100,
    coins: 50,
    desc: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
  },
  {
    id: 102,
    title: "Valid Parentheses",
    diff: "Easy",
    tags: ["String", "Stack"],
    hot: true,
    acceptance: "91.7%",
    trophy: 100,
    coins: 50,
    desc: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
  },
  {
    id: 203,
    title: "Longest Substring Without Repeating Characters",
    diff: "Medium",
    tags: ["Hash Table", "Sliding Window"],
    acceptance: "68.1%",
    trophy: 150,
    coins: 75,
    desc: "Given a string s, find the length of the longest substring without repeating characters.",
  },
  {
    id: 215,
    title: "Median of Two Sorted Arrays",
    diff: "Hard",
    tags: ["Array", "Binary Search"],
    acceptance: "45.2%",
    trophy: 200,
    coins: 100,
    desc: "Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.",
  },
  {
    id: 321,
    title: "Binary Tree Maximum Path Sum",
    diff: "Expert",
    tags: ["Tree", "Depth-First Search", "Dynamic Programming"],
    acceptance: "28.4%",
    trophy: 300,
    coins: 150,
    desc: "A path in a binary tree is a sequence of nodes where each pair of adjacent nodes in the sequence has an edge connecting them.",
  },
] as const;

export default function ChallengesPage() {
  const [active, setActive] = useState<Difficulty>("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () =>
      challenges.filter(
        (c) =>
          (active === "All" || c.diff === active) &&
          c.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [active, query],
  );

  return (
    <AppLayout sidebar={<ChallengesSidebar />} rail={<ChallengesRail />}>
      <header className="flex items-start gap-3">
        <IconBadge tone="blue" size={40}>
          <Code2 size={19} strokeWidth={2.2} />
        </IconBadge>
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Challenges</h1>
          <p className="mt-1 text-[13px] text-dim">
            Sharpen your skills. Solve problems. Climb the leaderboard.
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActive(f)}
              className={`rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                active === f
                  ? "border-blue/40 bg-blue/12 text-blue-300"
                  : "border-line bg-panel text-muted hover:text-fg"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search challenges…"
              aria-label="Search challenges"
              className="field w-56 !pl-9"
            />
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-4 py-2.5 text-[12.5px] font-semibold text-muted hover:text-fg"
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {visible.map((c) => {
          const meta = difficultyMeta[c.diff];
          const Icon = meta.icon;
          return (
            <article
              key={c.id}
              className={`card relative border-l-4 p-4 transition-colors hover:border-line/40 ${meta.border}`}
            >
              <button
                type="button"
                aria-label="Bookmark challenge"
                className="absolute right-4 top-4 text-dim hover:text-fg"
              >
                <Bookmark size={15} />
              </button>

              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 pr-6">
                    <span className="text-[11.5px] font-mono text-dim">#{c.id}</span>
                    <Icon size={14} className={meta.iconColor} strokeWidth={2.2} />
                    <h2 className="text-[16px] font-bold leading-snug">{c.title}</h2>
                    {c.hot && <Flame size={14} className="text-amber" fill="currentColor" />}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Tag tone={meta.tone}>{c.diff}</Tag>
                    {c.tags.map((t) => (
                      <Tag key={t} tone="slate">
                        {t}
                      </Tag>
                    ))}
                  </div>

                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-dim">{c.desc}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-5 text-[12px]">
                    <span className="text-dim">
                      Acceptance <strong className="font-semibold text-fg">{c.acceptance}</strong>
                    </span>
                    <span className="flex items-center gap-3 text-dim">
                      Reward
                      <span className="flex items-center gap-1 font-semibold text-amber">
                        <Trophy size={12} strokeWidth={2.2} />
                        {c.trophy}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-amber-300">
                        <Coins size={12} strokeWidth={2.2} />
                        {c.coins}
                      </span>
                    </span>
                  </div>
                </div>

                <Link
                  href="#"
                  className="btn btn-blue shrink-0 self-center !px-5 !py-2.5 !text-[12.5px]"
                >
                  Solve Now
                </Link>
              </div>
            </article>
          );
        })}

        {!visible.length && (
          <p className="card p-10 text-center text-[13px] text-dim">
            No challenges match your search yet.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-dim">Showing 1-10 of 120 challenges</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous page"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-muted hover:text-fg"
          >
            <ChevronLeft size={15} />
          </button>
          {[1, 2, 3].map((p) => (
            <button
              key={p}
              type="button"
              className={`h-8 w-8 rounded-lg text-[12.5px] font-semibold transition-colors ${
                p === 1 ? "bg-blue text-white" : "border border-line bg-panel text-muted hover:text-fg"
              }`}
            >
              {p}
            </button>
          ))}
          <span className="px-1 text-[12.5px] text-dim">…</span>
          <button
            type="button"
            className="h-8 w-8 rounded-lg border border-line bg-panel text-[12.5px] font-semibold text-muted hover:text-fg"
          >
            12
          </button>
          <button
            type="button"
            aria-label="Next page"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-muted hover:text-fg"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
