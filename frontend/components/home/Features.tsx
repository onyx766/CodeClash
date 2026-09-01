import { Code2, TrendingUp, Trophy, Zap } from "lucide-react";
import { IconBadge } from "../ui/Bits";
import SectionHeading from "./SectionHeading";

const features = [
  {
    icon: Zap,
    tone: "violet",
    title: "Real-Time Battles",
    desc: "Compete head-to-head in real-time coding challenges with developers worldwide.",
  },
  {
    icon: Code2,
    tone: "green",
    title: "Diverse Challenges",
    desc: "From easy warm-ups to hard algorithms. New challenges added every day.",
  },
  {
    icon: TrendingUp,
    tone: "amber",
    title: "Skill-Based Matchmaking",
    desc: "Get matched with players of similar skill for fair and exciting battles.",
  },
  {
    icon: Trophy,
    tone: "blue",
    title: "Earn & Climb",
    desc: "Earn points, unlock rewards, and climb the leaderboard to prove your skills.",
  },
] as const;

export default function Features() {
  return (
    <section className="cc-container py-14">
      <SectionHeading
        eyebrow="Why CodeClash?"
        title="Built for Developers, by Developers"
        subtitle="Everything you need to improve, compete, and grow."
      />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <article key={f.title} className="card group p-5 transition-colors hover:border-blue/35">
            <IconBadge tone={f.tone} size={44}>
              <f.icon size={20} strokeWidth={2.1} />
            </IconBadge>
            <h3 className="mt-4 text-[15px] font-bold tracking-tight">{f.title}</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-dim">{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
