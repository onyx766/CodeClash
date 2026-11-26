import { Globe, Lock, ShieldCheck, Users, Zap, Trophy, CircleCheck, TrendingUp, Radio } from "lucide-react";
import { AuthFooter } from "../layout/SiteFooter";

const codeLines = [
  { n: 1, content: <span className="text-dim">{"// two_sum.js"}</span> },
  {
    n: 2,
    content: (
      <>
        <span className="text-violet-300">function</span>{" "}
        <span className="text-blue-300">twoSum</span>
        <span className="text-muted">(nums, target) {"{"}</span>
      </>
    ),
  },
  {
    n: 3,
    content: (
      <span className="pl-4">
        <span className="text-violet-300">const</span>{" "}
        <span className="text-muted">seen = </span>
        <span className="text-amber">new Map()</span>
      </span>
    ),
  },
  {
    n: 4,
    content: (
      <span className="pl-4">
        <span className="text-violet-300">for</span>{" "}
        <span className="text-muted">(let i = 0; i {"<"} nums.length; i++) {"{"}</span>
      </span>
    ),
  },
  {
    n: 5,
    content: (
      <span className="pl-8">
        <span className="text-violet-300">const</span>{" "}
        <span className="text-muted">need = target - nums[i]</span>
      </span>
    ),
  },
  {
    n: 6,
    content: (
      <span className="pl-8">
        <span className="text-violet-300">if</span>{" "}
        <span className="text-muted">(seen.has(need)) </span>
        <span className="text-violet-300">return</span>{" "}
        <span className="text-muted">[seen.get(need), i]</span>
      </span>
    ),
  },
  { n: 7, content: <span className="pl-8 text-muted">seen.set(nums[i], i)</span> },
  { n: 8, content: <span className="pl-4 text-muted">{"}"}</span> },
  { n: 9, content: <span className="text-muted">{"}"}</span> },
];

const trust = [
  {
    icon: ShieldCheck,
    tone: "text-emerald-400",
    title: "Secure Login",
    text: "Your data is protected",
  },
  { icon: Lock, tone: "text-blue-400", title: "Privacy First", text: "We respect your privacy" },
  {
    icon: Zap,
    tone: "text-amber",
    title: "Live & Real-time",
    text: "Battles happen 24/7",
  },
  {
    icon: Globe,
    tone: "text-violet-400",
    title: "Global Community",
    text: "Compete with the best",
  },
];

export default function AuthLayout({
  title,
  highlight,
  subtitle,
  children,
}: {
  title: string;
  highlight: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-[calc(100vh-64px)] flex-col overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -left-24 top-24 h-[420px] w-[420px] rounded-full bg-blue/12 blur-[140px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-violet/12 blur-[140px]" />

      <div className="cc-container relative flex-1 py-10 lg:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
          {/* left marketing column */}
          <section className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-lg border border-violet/30 bg-violet/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300">
              <span className="font-mono text-blue-300">{"{ }"}</span> Code. Compete. Conquer.
            </span>

            <h1 className="mt-6 text-[clamp(2.1rem,5.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
              {title},
              <br />
              <span className="text-grad-bp">{highlight}</span>
            </h1>

            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-muted">{subtitle}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Users, tone: "text-emerald-400", head: "1v1", sub: "Head-to-head" },
                { icon: Zap, tone: "text-violet-400", head: "Live Battles", sub: "24/7" },
                { icon: Trophy, tone: "text-amber", head: "Rank. Code.", sub: "Win." },
              ].map((s) => (
                <div key={s.head} className="card-soft flex items-center gap-3 px-3.5 py-3">
                  <s.icon size={19} strokeWidth={2.2} className={s.tone} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{s.head}</span>
                    <span className="block text-[11.5px] text-dim">{s.sub}</span>
                  </span>
                </div>
              ))}
            </div>

            {/* code editor mockup */}
            <div className="relative mt-9 max-w-[520px]">
              <div className="card glow-blue overflow-hidden border-blue/25 bg-[#080d1c] p-0">
                <div className="flex items-center gap-2 border-b border-line/70 px-3.5 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green" />
                  <span className="ml-2 font-mono text-[11px] text-dim">solution.js</span>
                </div>
                <pre className="overflow-x-auto p-3.5 font-mono text-[11.5px] leading-[1.75]">
                  {codeLines.map((l) => (
                    <div key={l.n} className="flex gap-3 whitespace-pre">
                      <span className="w-3 shrink-0 select-none text-right text-dim/60">{l.n}</span>
                      {l.content}
                    </div>
                  ))}
                </pre>
              </div>

              <span className="absolute -right-2 -top-4 inline-flex items-center gap-1.5 rounded-lg border border-violet/35 bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-violet-300 sm:right-[-46px]">
                <Radio size={12} /> Live Match
              </span>
              <span className="absolute -right-3 top-1/2 inline-flex items-center gap-1.5 rounded-lg border border-blue/35 bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-blue-300 sm:right-[-56px]">
                <TrendingUp size={12} /> Rank Up
              </span>
              <span className="absolute -bottom-4 right-2 inline-flex items-center gap-1.5 rounded-lg border border-green/35 bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 sm:right-[-40px]">
                <CircleCheck size={12} /> 100% Focus
              </span>
            </div>
          </section>

          {/* right card */}
          <section className="w-full min-w-0 justify-self-center lg:justify-self-end">
            {children}
          </section>
        </div>

        <div className="card-soft mt-12 grid gap-5 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-line/70">
          {trust.map((t) => (
            <div key={t.title} className="flex items-center gap-3 lg:justify-center">
              <t.icon size={19} strokeWidth={2.2} className={t.tone} />
              <span>
                <span className="block text-[12.5px] font-semibold">{t.title}</span>
                <span className="block text-[11.5px] text-dim">{t.text}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <AuthFooter />
    </main>
  );
}
