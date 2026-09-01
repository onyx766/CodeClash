export default function RankBadge({ rank, size = 26 }: { rank: number; size?: number }) {
  const medal =
    rank === 1
      ? "bg-gradient-to-br from-amber-300 to-amber-600 text-ink border-amber-200/60"
      : rank === 2
        ? "bg-gradient-to-br from-slate-200 to-slate-500 text-ink border-slate-100/60"
        : rank === 3
          ? "bg-gradient-to-br from-orange-300 to-orange-700 text-ink border-orange-200/60"
          : "";

  if (rank > 3) {
    return (
      <span
        className="inline-flex items-center justify-center text-[13px] font-semibold text-dim"
        style={{ width: size, height: size }}
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border text-[12px] font-extrabold ${medal}`}
      style={{ width: size, height: size }}
    >
      {rank}
    </span>
  );
}
