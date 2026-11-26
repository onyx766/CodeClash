import { Code2, ShieldCheck, Trophy, Users } from "lucide-react";
import { IconBadge } from "../ui/Bits";

// What every battle is - facts about the game, not traffic numbers.
const stats = [
  { icon: Users, tone: "violet", value: "1v1", label: "Head-to-head battles" },
  { icon: Code2, tone: "green", value: "JavaScript", label: "Solutions run on Node.js" },
  { icon: ShieldCheck, tone: "blue", value: "Hidden tests", label: "Every submission judged on the server" },
  { icon: Trophy, tone: "amber", value: "Elo", label: "Ranked rating from Quick Match" },
] as const;

export default function StatsBar() {
  return (
    <section className="cc-container -mt-2 py-8">
      <div className="card grid gap-6 px-6 py-7 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3.5">
            <IconBadge tone={s.tone} size={44} rounded="rounded-xl">
              <s.icon size={20} strokeWidth={2.1} />
            </IconBadge>
            <div>
              <p className="text-[22px] font-extrabold leading-tight tracking-tight">{s.value}</p>
              <p className="text-[12.5px] text-dim">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
