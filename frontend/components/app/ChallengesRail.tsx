import Image from "next/image";
import { Panel } from "../ui/Bits";

const progress = [
  { label: "Easy", solved: 54, total: 60, color: "var(--color-green)", dot: "bg-green" },
  { label: "Medium", solved: 48, total: 60, color: "var(--color-amber)", dot: "bg-amber" },
  { label: "Hard", solved: 20, total: 50, color: "var(--color-rose)", dot: "bg-rose" },
  { label: "Expert", solved: 6, total: 20, color: "var(--color-violet)", dot: "bg-violet" },
];

const totalSolved = progress.reduce((s, p) => s + p.solved, 0);
const totalAll = progress.reduce((s, p) => s + p.total, 0);

const categories = [
  { label: "Array", count: 48 },
  { label: "String", count: 32 },
  { label: "Hash Table", count: 24 },
  { label: "Dynamic Programming", count: 20 },
  { label: "Tree", count: 18 },
  { label: "Graph", count: 16 },
  { label: "Math", count: 12 },
  { label: "Stack", count: 10 },
];

function ProgressRing() {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <div className="relative mx-auto h-[144px] w-[144px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="9" />
        {progress.map((p) => {
          const len = (p.solved / totalSolved) * circumference;
          const offset = cumulative;
          cumulative += len;
          return (
            <circle
              key={p.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${len - 3} ${circumference - len + 3}`}
              strokeDashoffset={-offset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold leading-none">{totalSolved}</span>
        <span className="mt-1 text-[11px] text-dim">Solved</span>
      </div>
    </div>
  );
}

export default function ChallengesRail() {
  return (
    <>
      <Panel title="Challenge Progress">
        <ProgressRing />
        <div className="mt-5 space-y-2.5">
          {progress.map((p) => (
            <div key={p.label} className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-2 text-muted">
                <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                {p.label}
              </span>
              <span className="font-semibold text-fg">
                {p.solved} / {p.total}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12.5px] font-semibold">
          <span>Total</span>
          <span>
            {totalSolved} / {totalAll}
          </span>
        </div>
      </Panel>

      <Panel title="Categories" bodyClassName="space-y-2.5">
        {categories.map((c) => (
          <div
            key={c.label}
            className="flex cursor-pointer items-center justify-between text-[13px] text-muted transition-colors hover:text-fg"
          >
            <span>{c.label}</span>
            <span className="text-dim">{c.count}</span>
          </div>
        ))}
        <button type="button" className="link-quiet mt-1 block">
          View All →
        </button>
      </Panel>

      <section className="card relative overflow-hidden border-violet/25 bg-gradient-to-br from-[#1a1440] to-[#0f1330] p-4">
        <div className="relative z-10 max-w-[70%]">
          <h2 className="text-[13.5px] font-bold">Weekly Challenge</h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
            Solve challenges to earn exclusive rewards!
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-violet to-blue" style={{ width: "47%" }} />
          </div>
          <p className="mt-2 text-[11px] text-dim">
            <span className="text-violet-300">7 / 15 solved</span>
          </p>
          <p className="mt-1 text-[10.5px] text-dim">Ends in 2d 12h 45m</p>
        </div>
        <Image
          src="/img/chest.png"
          alt=""
          width={320}
          height={320}
          className="pointer-events-none absolute -right-2 bottom-0 h-[100px] w-auto"
        />
      </section>
    </>
  );
}
