import { Code2, Play, Trophy, Users } from "lucide-react";
import SectionHeading from "./SectionHeading";

const steps = [
  {
    n: "01",
    icon: Users,
    ring: "border-blue/45 text-blue-300 bg-blue/10",
    num: "text-blue-400",
    title: "Find or Create Match",
    desc: "Use Quick Match or create a room and invite your friends.",
  },
  {
    n: "02",
    icon: Code2,
    ring: "border-violet/45 text-violet-300 bg-violet/10",
    num: "text-violet-400",
    title: "Solve the Challenge",
    desc: "Read the problem carefully and plan your solution.",
  },
  {
    n: "03",
    icon: Play,
    ring: "border-green/45 text-emerald-300 bg-green/10",
    num: "text-emerald-400",
    title: "Run & Submit",
    desc: "Test your code, fix issues, and submit your solution.",
  },
  {
    n: "04",
    icon: Trophy,
    ring: "border-amber/45 text-amber-300 bg-amber/10",
    num: "text-amber",
    title: "Earn Points & Climb",
    desc: "Get scored, earn rating points, and climb higher!",
  },
];

export default function HowItWorksStrip() {
  return (
    <section className="relative overflow-hidden py-14">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="cc-container relative">
        <SectionHeading
          eyebrow="How It Works"
          title="Start. Code. Win."
          subtitle="Just 4 simple steps to join the battle."
        />

        <div className="relative mt-12">
          <div className="absolute left-[12%] right-[12%] top-[30px] hidden border-t border-dashed border-line lg:block" />
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="relative text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-[13px] font-bold ${s.num}`}>{s.n}</span>
                  <span
                    className={`inline-flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 ${s.ring}`}
                  >
                    <s.icon size={24} strokeWidth={2} />
                  </span>
                </div>
                <h3 className="mt-5 text-[14.5px] font-bold tracking-tight">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-[220px] text-[12.5px] leading-relaxed text-dim">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
