import { Panel, Tag } from "../ui/Bits";
import type { ProfileStats } from "../../hooks/useProfile";
import { formatWinRate } from "../../hooks/useLeaderboard";

function Record({
  title,
  subtitle,
  badge,
  tone,
  played,
  wins,
  losses,
  draws,
}: {
  title: string;
  subtitle: string;
  badge: string;
  tone: string;
  played?: number;
  wins?: number;
  losses?: number;
  draws?: number;
}) {
  const known = played !== undefined && wins !== undefined;
  const cells = [
    { label: "Played", value: played ?? "—" },
    { label: "Wins", value: wins ?? "—" },
    { label: "Losses", value: losses ?? "—" },
    { label: "Draws", value: draws ?? "—" },
    { label: "Win Rate", value: known ? formatWinRate(wins, played) : "—" },
  ];
  return (
    <div className="card-soft p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-bold">{title}</p>
          <p className="mt-0.5 text-[11px] text-dim">{subtitle}</p>
        </div>
        <Tag tone={tone}>{badge}</Tag>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1.5 text-center">
        {cells.map((cell) => (
          <div key={cell.label}>
            <p className="text-[16px] font-extrabold leading-none">{cell.value}</p>
            <p className="mt-1.5 text-[10.5px] text-dim">{cell.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ranked and casual results side by side: only ranked games move rating. */
export default function RecordsPanel({ stats }: { stats: ProfileStats | null }) {
  return (
    <Panel title="Match Records" className="mt-4" bodyClassName="grid gap-3 sm:grid-cols-2">
      <Record
        title="Ranked"
        subtitle="Quick Match"
        badge="Moves rating"
        tone="amber"
        played={stats?.matchesPlayed}
        wins={stats?.wins}
        losses={stats?.losses}
        draws={stats?.draws}
      />
      <Record
        title="Casual"
        subtitle="Private rooms"
        badge="Unrated"
        tone="violet"
        played={stats?.casualMatchesPlayed}
        wins={stats?.casualWins}
        losses={stats?.casualLosses}
        draws={stats?.casualDraws}
      />
    </Panel>
  );
}
