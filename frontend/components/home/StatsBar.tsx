import { Code2, Globe, Trophy, Users } from "lucide-react";
import { IconBadge } from "../ui/Bits";

const stats = [
  { icon: Users, tone: "violet", value: "25K+", label: "Developers" },
  { icon: Code2, tone: "green", value: "150K+", label: "Battles Played" },
  { icon: Trophy, tone: "amber", value: "1.2M+", label: "Lines of Code" },
  { icon: Globe, tone: "blue", value: "120+", label: "Countries" },
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
