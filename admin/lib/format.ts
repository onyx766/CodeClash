/** Presentation helpers shared by the admin tables. */

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * "2 minutes ago" style. Returns "Never" for a null timestamp rather than
 * inventing one - accounts that have never signed in genuinely have no value.
 */
export function formatRelative(iso: string | null): string {
  if (!iso) return "Never";

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return seconds <= 5 ? "just now" : `${seconds} seconds ago`;

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
    [30, "month"],
    [12, "year"],
  ];

  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [size, nextUnit] of units) {
    if (value < size) break;
    value = Math.floor(value / size);
    unit = nextUnit;
  }

  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/**
 * How recently an account was seen, as a traffic-light tone. Null (never
 * signed in) is neutral rather than "offline red".
 */
export function activityTone(iso: string | null): "green" | "amber" | "neutral" {
  if (!iso) return "neutral";
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days <= 1) return "green";
  if (days <= 30) return "amber";
  return "neutral";
}

/** Stable per-username gradient so avatars are recognisable between reloads. */
const AVATAR_GRADIENTS = [
  "from-blue to-violet",
  "from-teal to-blue",
  "from-violet to-rose",
  "from-amber to-rose",
  "from-green to-teal",
  "from-rose to-violet",
];

export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/[\s_.-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
