import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Gauge, Play, ShieldCheck, Trophy, Zap } from "lucide-react";
import { avatarStack } from "../../lib/demo";

const heroChips = [
  { icon: Zap, title: "Live Battles", desc: "Real-time coding", tone: "text-blue-300 border-blue/30 bg-blue/10" },
  { icon: ShieldCheck, title: "Fair Play", desc: "Anti-cheat system", tone: "text-violet-300 border-violet/30 bg-violet/10" },
  { icon: Gauge, title: "Smart Scoring", desc: "Skill-based matchups", tone: "text-sky-300 border-sky-400/30 bg-sky-400/10" },
];

function CodeCard({
  name,
  rating,
  accent,
  passed,
  total,
  solved,
}: {
  name: string;
  rating: number;
  accent: "blue" | "rose";
  passed: number;
  total: number;
  solved?: boolean;
}) {
  const ring = accent === "blue" ? "border-blue/35" : "border-rose/35";
  const dot = accent === "blue" ? "text-blue-300" : "text-rose-300";
  return (
    <div className={`card w-full max-w-[240px] border ${ring} bg-surface/90 p-3 backdrop-blur-md`}>
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${dot}`}>
          <Trophy size={12} strokeWidth={2.4} />
          {name}
        </span>
        <span className="flex items-center gap-1 text-[11.5px] font-semibold text-amber">
          <Trophy size={11} strokeWidth={2.4} />
          {rating}
        </span>
      </div>

      <pre className="mt-2.5 overflow-hidden rounded-lg border border-line/70 bg-ink/70 p-2.5 font-mono text-[9.5px] leading-[1.5] text-dim">
        <code>
          <span className="text-violet-300">function</span>{" "}
          <span className="text-blue-300">twoSum</span>(nums, target) {"{"}
          {"\n  "}
          <span className="text-dim/70">{"// your code here"}</span>
          {"\n"}
          {"}"}
        </code>
      </pre>

      <div className="mt-2.5 flex items-end justify-between">
        <div>
          <p className="text-[10px] text-dim">Test Results</p>
          <p
            className={`text-[11.5px] font-semibold ${
              solved ? "text-emerald-400" : "text-amber"
            }`}
          >
            {passed} / {total} Passed
          </p>
        </div>
        {solved && <Check size={14} className="mb-0.5 text-emerald-400" strokeWidth={3} />}
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line/60">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-blue/12 blur-[130px]" />
      <div className="pointer-events-none absolute -right-32 top-10 h-[460px] w-[460px] rounded-full bg-violet/14 blur-[140px]" />

      <div className="cc-container relative grid items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-violet-300">
            <Zap size={12} strokeWidth={2.6} />
            Real-Time Code Battles
          </span>

          <h1 className="mt-6 text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            Code. Compete.
            <br />
            <span className="text-grad-bp">Conquer.</span>
          </h1>

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
            Challenge developers worldwide in real-time JavaScript battles. Solve problems,
            earn points, and climb the leaderboard to become the ultimate CodeClash champion.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/lobby" className="btn btn-blue !px-6 !py-3.5">
              Start Coding Now <ArrowRight size={16} />
            </Link>
            <Link href="/how-it-works" className="btn btn-ghost !px-6 !py-3.5">
              <Play size={15} /> Watch How It Works
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-3.5">
            <div className="flex -space-x-2.5">
              {avatarStack.slice(0, 3).map((src) => (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  width={160}
                  height={160}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-base"
                />
              ))}
            </div>
            <div>
              <p className="text-[13px] font-medium text-fg">
                12,248+ developers are already coding
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-dim">
                <span className="dot-live" /> 1,248 online now
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-ink">
            <Image
              src="/img/hero-battle.png"
              alt="Two developers competing in a live coding battle"
              width={1200}
              height={800}
              priority
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-ink/45" />

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
              <CodeCard name="Tyler" rating={1850} accent="blue" passed={8} total={10} />
              <CodeCard name="Alex" rating={1650} accent="rose" passed={7} total={10} solved />
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="float-slow bg-gradient-to-b from-white via-violet-200 to-blue-400 bg-clip-text text-[clamp(2.5rem,7vw,4.5rem)] font-black italic tracking-tighter text-transparent drop-shadow-[0_0_28px_rgba(139,92,246,0.8)]">
                VS
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {heroChips.map((chip) => (
              <div
                key={chip.title}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-panel/70 px-3 py-2.5"
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${chip.tone}`}
                >
                  <chip.icon size={15} strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold">{chip.title}</span>
                  <span className="block truncate text-[11px] text-dim">{chip.desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
