"use client";

import { useState } from "react";
import Image from "next/image";
import {
  BarChart3,
  ChevronRight,
  Code2,
  LogIn,
  Play,
  Plus,
  Rocket,
  Send,
  Star,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import MainSidebar from "../../components/app/MainSidebar";
import { Avatar, IconBadge, Panel, Tag } from "../../components/ui/Bits";
import { leaderboard } from "../../lib/demo";

const faqs = [
  {
    q: "How does the scoring work?",
    a: "Scores are based on correctness (700 pts), performance (150 pts), and time bonus (150 pts).",
  },
  {
    q: "What happens if time runs out?",
    a: "Your current solution is evaluated and scored based on the tests passed and performance.",
  },
  {
    q: "Can I change language?",
    a: "Yes! You can choose from JavaScript (default) and more languages coming soon.",
  },
  {
    q: "How is my rating calculated?",
    a: "We use an Elo-based system — beating stronger players earns you more rating points.",
  },
];

function QuickMatchVisual() {
  return (
    <div className="card-soft space-y-3 p-4">
      <button type="button" className="btn btn-blue w-full !py-2.5 !text-[12.5px]">
        <Zap size={14} /> Find Match
      </button>
      <p className="text-center text-[11px] text-dim">OR</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button type="button" className="btn btn-violet !py-2.5 !text-[12px]">
          <Plus size={14} /> Create Room
        </button>
        <button type="button" className="btn btn-outline-green !py-2.5 !text-[12px]">
          <LogIn size={14} /> Join Room
        </button>
      </div>
    </div>
  );
}

function ChallengeVisual() {
  return (
    <div className="card-soft p-4">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold">Two Sum</span>
        <Tag tone="amber">Medium</Tag>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-dim">
        Given an array of integers and a target, return the indices of the two numbers that add up to the target.
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <span className="text-[11.5px] text-muted">Examples</span>
        <span className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-white/25" />
          ))}
        </span>
      </div>
    </div>
  );
}

function RunTestVisual() {
  const tests = [
    { name: "Test 1", ok: true },
    { name: "Test 2", ok: true },
    { name: "Test 3", ok: true },
    { name: "Test 4", ok: false },
    { name: "Test 5", ok: true },
  ];

  return (
    <div className="card-soft overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="rounded-md border border-line px-2 py-1 font-mono text-[10.5px] text-muted">JavaScript</span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-green/35 bg-green/12 px-2 py-1 text-[10.5px] font-semibold text-emerald-300">
          <Play size={10} /> Run Tests
        </span>
      </div>
      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_140px]">
        <pre className="overflow-x-auto p-3 font-mono text-[10.5px] leading-relaxed text-muted">
          {`function twoSum(nums, target) {
  // your code here
}`}
        </pre>
        <div className="border-t border-line p-3 sm:border-l sm:border-t-0">
          <p className="text-[11px] font-semibold">Test Results</p>
          <p className="mt-0.5 text-[10.5px] text-emerald-300">8 / 10 Passed</p>
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
    <div className="card-soft p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
        <pre className="overflow-x-auto rounded-lg bg-[#080d1c] p-3 font-mono text-[10.5px] leading-relaxed text-muted">
          {`function twoSum(nums, target) {
  // your code here
}`}
        </pre>
        <div className="rounded-lg border border-violet/25 bg-violet/8 p-3 text-center">
          <p className="text-[10.5px] text-dim">Submission</p>
          <p className="mt-1 text-[11.5px] font-bold text-violet-300">Submitted!</p>
          <p className="mt-1 text-[10px] text-dim">Waiting for opponent…</p>
        </div>
      </div>
    </div>
  );
}

function ScoreVisual() {
  const rows = [
    { label: "Correctness", value: "700 / 700", tone: "text-emerald-300" },
    { label: "Performance", value: "150 / 150", tone: "text-blue-300" },
    { label: "Time Bonus", value: "123 / 150", tone: "text-amber" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="card-soft p-3.5">
        <p className="text-[12px] font-bold">Score Breakdown</p>
        <ul className="mt-2.5 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between text-[11.5px]">
              <span className="text-dim">{r.label}</span>
              <span className={`font-semibold ${r.tone}`}>{r.value}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11.5px] font-bold">
          <span>Total Score</span>
          <span className="text-violet-300">973 / 1000</span>
        </div>
      </div>
      <div className="card-soft p-3.5 text-center">
        <p className="text-[12px] font-bold">Round Result</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span>
            <Avatar src="/img/avatars/avatar-7.png" alt="You" size={34} />
            <span className="mt-1 block text-[10.5px] text-dim">You</span>
            <span className="block text-[12px] font-bold text-emerald-300">973</span>
          </span>
          <span className="text-[11px] font-bold text-dim">VS</span>
          <span>
            <Avatar src="/img/avatars/avatar-6.png" alt="Opponent" size={34} />
            <span className="mt-1 block text-[10.5px] text-dim">Opponent</span>
            <span className="block text-[12px] font-bold text-rose-300">882</span>
          </span>
        </div>
        <p className="mt-3 text-[11.5px] font-semibold text-emerald-300">You won this round! 🎉</p>
      </div>
    </div>
  );
}

function RankUpVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="card-soft p-3.5">
        <p className="text-[12px] font-bold">Rating Update</p>
        <p className="mt-3 flex items-center gap-2 text-[19px] font-extrabold text-violet-300">
          1850 <span className="text-[12.5px] font-bold text-emerald-400">+24</span>
        </p>
        <p className="mt-2 text-[11.5px] text-dim">
          New Rating <span className="font-semibold text-fg">1874</span>
        </p>
      </div>
      <div className="card-soft p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold">Leaderboard</p>
          <span className="link-quiet">View All</span>
        </div>
        <ul className="mt-2.5 space-y-2">
          {leaderboard.slice(0, 3).map((p, i) => (
            <li key={p.name} className="flex items-center gap-2 text-[11.5px]">
              <span className="w-3 text-dim">{i + 1}</span>
              <Avatar src={p.avatar} alt={p.name} size={20} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="font-semibold text-violet-300">{p.rating}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const steps = [
  {
    n: "01",
    tone: "blue" as const,
    icon: Users,
    title: "Find an Opponent",
    desc: "Use Quick Match to find an opponent instantly or create / join a room with your friends.",
    visual: <QuickMatchVisual />,
  },
  {
    n: "02",
    tone: "violet" as const,
    icon: Code2,
    title: "Solve the Challenge",
    desc: "Both players receive the same challenge. Read the problem carefully and plan your approach.",
    visual: <ChallengeVisual />,
  },
  {
    n: "03",
    tone: "green" as const,
    icon: Play,
    title: "Run & Test Your Code",
    desc: "Click Run to test your solution against public test cases. Fix issues and improve your approach.",
    visual: <RunTestVisual />,
  },
  {
    n: "04",
    tone: "violet" as const,
    icon: Send,
    title: "Submit Your Solution",
    desc: "Click Submit to run both public and hidden tests. This will determine your score for the round.",
    visual: <SubmitVisual />,
  },
  {
    n: "05",
    tone: "amber" as const,
    icon: Trophy,
    title: "Score is Calculated",
    desc: "Your score is based on correctness, performance, and time. The higher your score, the better!",
    visual: <ScoreVisual />,
  },
  {
    n: "06",
    tone: "teal" as const,
    icon: BarChart3,
    title: "Win & Rank Up",
    desc: "Win the match, earn rating points, and climb the leaderboard to become the best!",
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
              <button type="button" className="btn btn-blue mt-4 w-full !py-2.5 !text-[12px]">
                Join Queue
              </button>
            </div>
          }
        />
      }
      rail={
        <>
          <Panel title="Leaderboard Snapshot" bodyClassName="space-y-3">
            {leaderboard.slice(0, 4).map((player) => (
              <div key={player.name} className="flex items-center gap-2.5">
                <Avatar src={player.avatar} alt={player.name} size={28} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{player.name}</span>
                <span className="flex items-center gap-1 text-[11.5px] font-bold text-violet-300">
                  <BarChart3 size={11} /> {player.rating}
                </span>
              </div>
            ))}
          </Panel>

          <Panel title="Fast Facts" bodyClassName="space-y-2.5">
            <div className="card-soft p-3">
              <p className="text-[10.5px] uppercase tracking-[0.12em] text-dim">Battle windows</p>
              <p className="mt-1 text-[16px] font-extrabold">3 mins</p>
            </div>
            <div className="card-soft p-3">
              <p className="text-[10.5px] uppercase tracking-[0.12em] text-dim">Avg. solve rate</p>
              <p className="mt-1 text-[16px] font-extrabold">84%</p>
            </div>
          </Panel>
        </>
      }
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
