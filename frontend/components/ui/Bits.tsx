import Image from "next/image";
import { Trophy } from "lucide-react";

export function Avatar({
  src,
  alt,
  size = 36,
  ring,
  online,
  className = "",
}: {
  src: string;
  alt: string;
  size?: number;
  ring?: boolean;
  online?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        width={160}
        height={160}
        className={`h-full w-full rounded-full object-cover ${
          ring ? "ring-2 ring-violet/70" : "ring-1 ring-line"
        }`}
      />
      {online && (
        <span
          className="absolute -right-0.5 -bottom-0.5 rounded-full bg-green ring-2 ring-surface"
          style={{ width: Math.max(8, size * 0.26), height: Math.max(8, size * 0.26) }}
        />
      )}
    </span>
  );
}

export function RatingChip({
  value,
  className = "",
}: {
  value: number | string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[12px] font-semibold text-amber ${className}`}
    >
      <Trophy size={12} strokeWidth={2.4} />
      {value}
    </span>
  );
}

const toneMap: Record<string, string> = {
  blue: "bg-blue/12 text-blue-300 border-blue/25",
  violet: "bg-violet/12 text-violet-300 border-violet/25",
  green: "bg-green/12 text-emerald-300 border-green/25",
  amber: "bg-amber/12 text-amber-300 border-amber/25",
  rose: "bg-rose/12 text-rose-300 border-rose/25",
  teal: "bg-teal/12 text-teal-300 border-teal/25",
  slate: "bg-white/5 text-muted border-line",
};

export function Tag({
  children,
  tone = "slate",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneMap | string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-[3px] text-[11px] font-semibold ${
        toneMap[tone] ?? toneMap.slate
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <h2 className="rail-title">{title}</h2>
          {action}
        </header>
      )}
      <div className={`px-4 pb-4 ${title ? "" : "pt-4"} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Progress({
  value,
  tone = "violet",
  className = "",
}: {
  value: number;
  tone?: "violet" | "blue" | "green";
  className?: string;
}) {
  const grad =
    tone === "blue"
      ? "from-blue to-sky-400"
      : tone === "green"
        ? "from-green to-emerald-400"
        : "from-blue to-violet";
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/8 ${className}`}>
      <div
        className={`h-full rounded-full bg-gradient-to-r ${grad}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function IconBadge({
  children,
  tone = "blue",
  size = 40,
  rounded = "rounded-xl",
}: {
  children: React.ReactNode;
  tone?: "blue" | "violet" | "green" | "amber" | "teal" | "rose";
  size?: number;
  rounded?: string;
}) {
  const tones: Record<string, string> = {
    blue: "from-blue/25 to-blue/5 text-blue-300 border-blue/25",
    violet: "from-violet/25 to-violet/5 text-violet-300 border-violet/25",
    green: "from-green/25 to-green/5 text-emerald-300 border-green/25",
    amber: "from-amber/25 to-amber/5 text-amber-300 border-amber/25",
    teal: "from-teal/25 to-teal/5 text-teal-300 border-teal/25",
    rose: "from-rose/25 to-rose/5 text-rose-300 border-rose/25",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border bg-gradient-to-br ${rounded} ${tones[tone]}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}
