const WIDTH = 560;
const HEIGHT = 200;
// The left padding is the gutter for the rating labels, so they never sit
// on top of the line.
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 28;
const PAD_BOTTOM = 24;

function niceStep(range: number) {
  const rough = range / 4;
  const pow = 10 ** Math.floor(Math.log10(rough || 1));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * pow);
  return candidates.find((c) => c >= rough) ?? candidates[candidates.length - 1];
}

export default function RatingLineChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  if (!data.length) return null;

  const values = data.map((d) => d.value);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  const step = niceStep(rawMax - rawMin || 100);
  const min = Math.floor(rawMin / step) * step;
  // A flat line (e.g. only unrated draws) still gets one grid step of room.
  const max = Math.max(Math.ceil(rawMax / step) * step, min + step);
  const span = max - min;

  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;

  const points = data.map((d, i) => {
    const x = PAD_LEFT + (data.length > 1 ? i / (data.length - 1) : 0.5) * plotWidth;
    const y = PAD_TOP + plotHeight - ((d.value - min) / span) * plotHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} L${points[0].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} Z`;

  const gridLines = Array.from({ length: Math.round(span / step) + 1 }, (_, i) => min + i * step);
  const last = points[points.length - 1];
  const labelStride = Math.ceil(data.length / 5);
  // About five dates along the axis, without repeating a day.
  const dateLabels = points.reduce<((typeof points)[number] & { index: number })[]>((acc, p, index) => {
    const wanted = index % labelStride === 0 || index === points.length - 1;
    if (wanted && acc[acc.length - 1]?.label !== p.label) acc.push({ ...p, index });
    return acc;
  }, []);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Rating over time">
        <defs>
          <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-violet)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-violet)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => {
          const y = PAD_TOP + plotHeight - ((g - min) / span) * plotHeight;
          return (
            <g key={g}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
              <text x={PAD_LEFT - 6} y={y + 3.5} fontSize="10" fill="var(--color-dim)" textAnchor="end">
                {g}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#ratingGrad)" />
        <path d={linePath} fill="none" stroke="var(--color-violet)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {dateLabels.map((p) => (
          <text
            key={p.index}
            x={p.x}
            y={HEIGHT - 6}
            fontSize="10"
            fill="var(--color-dim)"
            textAnchor={p.index === 0 ? "start" : p.index === points.length - 1 ? "end" : "middle"}
          >
            {p.label}
          </text>
        ))}

        <circle cx={last.x} cy={last.y} r="4" fill="var(--color-violet)" stroke="var(--color-panel)" strokeWidth="2" />

        <g transform={`translate(${Math.min(last.x, WIDTH - 68)}, ${Math.max(last.y - 34, 4)})`}>
          <rect width="64" height="26" rx="7" fill="var(--color-panel-2)" stroke="var(--color-line)" />
          <text x="32" y="11" fontSize="10.5" fontWeight="700" fill="var(--color-fg)" textAnchor="middle">
            {last.value}
          </text>
          <text x="32" y="21.5" fontSize="9" fill="var(--color-dim)" textAnchor="middle">
            {last.label}
          </text>
        </g>
      </svg>
    </div>
  );
}
