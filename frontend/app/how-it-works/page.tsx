"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, ChevronRight, Code2, LogIn, Play, Plus, Send, Trophy, Users, Zap } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import MainSidebar from "../../components/app/MainSidebar";
import TopPlayersPanel from "../../components/app/TopPlayersPanel";
import { Avatar, IconBadge, Tag, avatarForUserId } from "../../components/ui/Bits";
import useLeaderboard from "../../hooks/useLeaderboard";

const faqs = [
  {
    q: "How is the winner decided?",
    a: "The first player to solve every challenge wins. If time runs out first, whoever solved more challenges wins; with the same number solved, the lower total solve time wins. If neither player solved anything, the match is a draw.",
  },
  {
    q: "What counts as solving a challenge?",
    a: "Submitting code that passes all of its public and hidden tests. Run only checks the public examples and never solves a challenge, so use it as often as you like.",
  },
  {
    q: "Can I change language?",
    a: "Not yet: battles are JavaScript only, and solutions run on Node.js.",
  },
  {
    q: "How is my rating calculated?",
    a: "CodeClash uses an Elo-based system: beating a stronger player earns more rating points than beating a weaker one. Only ranked Quick Match games change your rating; private rooms are casual.",
  },
  {
    q: "What happens if I leave a match?",
    a: "The match keeps running and you can return to it from the lobby. Giving up ends it straight away and your opponent wins.",
  },
];

// The visuals illustrate each step; they are pictures, not controls.
function QuickMatchVisual() {
  return (
    <div className="card-soft space-y-3 p-4" aria-hidden="true">
      <span className="btn btn-blue pointer-events-none w-full !py-2.5 !text-[12.5px]">
        <Zap size={14} /> Find Match
      </span>
      <p className="text-center text-[11px] text-dim">OR</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <span className="btn btn-violet pointer-events-none !py-2.5 !text-[12px]">
          <Plus size={14} /> Create Room
        </span>
        <span className="btn btn-outline-green pointer-events-none !py-2.5 !text-[12px]">
          <LogIn size={14} /> Join Room
        </span>
      </div>
    </div>
  );
}

function ChallengeVisual() {
  const problems = [
    { title: "Two Sum", difficulty: "Easy", tone: "green" },
    { title: "Valid Parentheses", difficulty: "Easy", tone: "green" },
    { title: "Maximum Subarray", difficulty: "Medium", tone: "amber" },
    { title: "Trapping Rain Water", difficulty: "Hard", tone: "rose" },
  ];
  return (
    <div className="card-soft p-4" aria-hidden="true">
      <p className="text-[12px] font-bold">Problems</p>
      <ul className="mt-2.5 space-y-2">
        {problems.map((p, i) => (
          <li key={p.title} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-3 text-dim">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
            <Tag tone={p.tone}>{p.difficulty}</Tag>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunTestVisual() {
  const tests = [
    { name: "Example 1", ok: true },
    { name: "Example 2", ok: true },
    { name: "Example 3", ok: false },
  ];

  return (
    <div className="card-soft overflow-hidden p-0" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="rounded-md border border-line px-2 py-1 font-mono text-[10.5px] text-muted">JavaScript</span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-green/35 bg-green/12 px-2 py-1 text-[10.5px] font-semibold text-emerald-300">
          <Play size={10} /> Run Tests
        </span>
      </div>
      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_140px]">
        <pre className="overflow-x-auto p-3 font-mono text-[10.5px] leading-relaxed text-muted">
          {`function solve(nums, target) {
  // your code here
}`}
        </pre>
        <div className="border-t border-line p-3 sm:border-l sm:border-t-0">
          <p className="text-[11px] font-semibold">Public examples</p>
          <p className="mt-0.5 text-[10.5px] text-amber">2 / 3 passed</p>
          <ul className="mt-2 space-y-1">
            {tests.map((t) => (
              <li key={t.name} className="flex items-center justify-between text-[10.5px]">
                <span className="text-dim">{t.name}</span>
                <span className={t.ok ? "text-emerald-400" : "text-rose-400"}>{t.ok ? "✓" : "✕"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SubmitVisual() {
  return (
    <div className="card-soft p-3" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
        <pre className="overflow-x-auto rounded-lg bg-[#080d1c] p-3 font-mono text-[10.5px] leading-relaxed text-muted">
          {`function solve(nums, target) {
  const seen = new Map();
  // ...
}`}
        </pre>
        <div className="rounded-lg border border-green/25 bg-green/8 p-3 text-center">
          <p className="text-[10.5px] text-dim">Submission</p>
          <p className="mt-1 text-[11.5px] font-bold text-emerald-300">Accepted</p>
          <p className="mt-1 text-[10px] text-dim">Challenge solved</p>
        </div>
      </div>
    </div>
  );
}

function ResultVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
      <div className="card-soft p-3.5">
        <p className="text-[12px] font-bold">Live Progress</p>
        <ul className="mt-2.5 space-y-2">
          {[
            { label: "You", solved: 5 },
            { label: "Opponent", solved: 3 },
          ].map((p) => (
            <li key={p.label} className="text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="text-dim">{p.label}</span>
                <span className="font-semibold">{p.solved} / 5 solved</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-gradient-to-r from-blue to-violet" style={{ width: `${p.solved * 20}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="card-soft p-3.5 text-center">
        <p className="text-[12px] font-bold">Match Result</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span>
            <Avatar src="/img/avatars/avatar-7.png" alt="" size={34} />
            <span className="mt-1 block text-[10.5px] text-dim">You</span>
            <span className="block text-[12px] font-bold text-emerald-300">5 / 5</span>
          </span>
          <span className="text-[11px] font-bold text-dim">VS</span>
          <span>
            <Avatar src="/img/avatars/avatar-6.png" alt="" size={34} />
            <span className="mt-1 block text-[10.5px] text-dim">Opponent</span>
            <span className="block text-[12px] font-bold text-rose-300">3 / 5</span>
          </span>
        </div>
        <p className="mt-3 text-[11.5px] font-semibold text-emerald-300">Victory: all challenges solved first</p>
      </div>
    </div>
  );
}

function RankUpVisual() {
  // The live top three, so the example never shows made-up players.
  const { entries } = useLeaderboard(3);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="card-soft p-3.5" aria-hidden="true">
        <p className="text-[12px] font-bold">Rating Update</p>
        <p className="mt-3 flex items-center gap-2 text-[19px] font-extrabold text-violet-300">
          1216 <span className="text-[12.5px] font-bold text-emerald-400">+16</span>
        </p>
        <p className="mt-2 text-[11.5px] text-dim">After a ranked win against an equal opponent</p>
      </div>
      <Link href="/leaderboard" className="card-soft block p-3.5 transition-colors hover:border-blue/35">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold">Leaderboard</p>
          <span className="link-quiet">View All</span>
        </div>
        {entries && entries.length > 0 ? (
          <ul className="mt-2.5 space-y-2">
            {entries.map((p) => {
              const name = p.displayName || p.username;
              return (
                <li key={p.id} className="flex items-center gap-2 text-[11.5px]">
                  <span className="w-3 text-dim">{p.rank}</span>
                  <Avatar src={p.avatarUrl || avatarForUserId(p.id)} alt={name} size={20} />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="font-semibold text-violet-300">{p.rating}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2.5 text-[11.5px] text-dim">See who is on top right now.</p>
        )}
      </Link>
    </div>
  );
}

const steps = [
  {
    n: "01",
    tone: "blue" as const,
    icon: Users,
    title: "Find an Opponent",
    desc: "Quick Match pairs you with a player near your rating for a ranked game; both of you accept within a few seconds. Or create a private room and invite a friend with its code or username.",
    visual: <QuickMatchVisual />,
  },
  {
    n: "02",
    tone: "violet" as const,
    icon: Code2,
    title: "Get the Same Challenges",
    desc: "Both players receive the same set of problems, from easy to hard. Solve them in any order before the match clock runs out.",
    visual: <ChallengeVisual />,
  },
  {
    n: "03",
    tone: "green" as const,
    icon: Play,
    title: "Run Your Code",
    desc: "Run tests your solution against the public examples. It never counts as a solve, so iterate as much as you need.",
    visual: <RunTestVisual />,
  },
  {
    n: "04",
    tone: "violet" as const,
    icon: Send,
    title: "Submit Your Solution",
    desc: "Submit judges your code on the server against the public and hidden tests. Only an Accepted verdict solves the challenge.",
    visual: <SubmitVisual />,
  },
  {
    n: "05",
    tone: "amber" as const,
    icon: Trophy,
    title: "Win the Match",
    desc: "You see your opponent's progress live. The first to solve every challenge wins; when time runs out, more solved wins, then the faster total solve time.",
    visual: <ResultVisual />,
  },
  {
    n: "06",
    tone: "teal" as const,
    icon: BarChart3,
    title: "Rank Up",
    desc: "Ranked wins earn Elo rating points and move you up the leaderboard. Private rooms are casual and never change your rating.",
    visual: <RankUpVisual />,
  },
];

export default function HowItWorksPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <AppLayout
      sidebar={
        <MainSidebar
          footer={
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <IconBadge tone="violet" size={32}>
                  <Zap size={16} />
                </IconBadge>
                <div>
                  <p className="text-[12px] font-bold">Ranked Matches</p>
                  <p className="text-[11px] text-dim">Live competitive mode</p>
                </div>
              </div>
              <Link href="/lobby" className="btn btn-blue mt-4 w-full !py-2.5 !text-[12px]">
                Find a Match
              </Link>
            </div>
          }
        />
      }
      rail={<TopPlayersPanel title="Leaderboard Snapshot" limit={4} />}
    >
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-[clamp(1.6rem,3.4vw,2.1rem)] font-extrabold tracking-[-0.025em]">
            How <span className="text-grad-bp">CodeClash</span> Works
          </h1>
          <p className="mt-1.5 text-[13px] text-dim">
            Jump in, code, compete, and climb the leaderboard.
          </p>
        </div>
        <Image
          src="/img/how-it-works-hero.png"
          alt=""
          width={640}
          height={420}
          className="h-[110px] w-auto"
          priority
        />
      </header>

      <div className="relative mt-8">
        <div className="absolute bottom-6 left-[19px] top-6 hidden w-px border-l border-dashed border-line sm:block" />
        <ol className="space-y-4">
          {steps.map((s) => (
            <li key={s.n} className="relative sm:pl-14">
              <span className="absolute left-0 top-6 hidden h-10 w-10 items-center justify-center rounded-full border border-line bg-panel text-[12px] font-bold text-dim sm:inline-flex">
                {s.n}
              </span>
              <div className="card grid gap-5 p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="flex gap-3.5">
                  <IconBadge tone={s.tone} size={42}>
                    <s.icon size={19} />
                  </IconBadge>
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-bold">{s.title}</h2>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">{s.desc}</p>
                  </div>
                </div>
                <div className="min-w-0">{s.visual}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="text-[16px] font-bold">Frequently Asked Questions</h2>
        <ul className="mt-4 space-y-2.5">
          {faqs.map((f, i) => (
            <li key={f.q} className="card-soft overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="text-[13px] font-semibold">{f.q}</span>
                <ChevronRight
                  size={16}
                  className={`shrink-0 text-dim transition-transform ${
                    openFaq === i ? "rotate-90" : ""
                  }`}
                />
              </button>
              {openFaq === i && (
                <p className="px-4 pb-3.5 text-[12px] leading-relaxed text-dim">{f.a}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </AppLayout>
  );
}
