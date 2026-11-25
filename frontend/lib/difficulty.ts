import type { Difficulty } from "./battle";

export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "EXPERT"];

/** Label and colours per difficulty, shared by the catalogue and its rail. */
export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; tone: string; border: string; text: string; dot: string; color: string }
> = {
  EASY: {
    label: "Easy",
    tone: "green",
    border: "border-l-green",
    text: "text-emerald-400",
    dot: "bg-green",
    color: "var(--color-green)",
  },
  MEDIUM: {
    label: "Medium",
    tone: "amber",
    border: "border-l-amber",
    text: "text-amber",
    dot: "bg-amber",
    color: "var(--color-amber)",
  },
  HARD: {
    label: "Hard",
    tone: "rose",
    border: "border-l-rose",
    text: "text-rose-400",
    dot: "bg-rose",
    color: "var(--color-rose)",
  },
  EXPERT: {
    label: "Expert",
    tone: "violet",
    border: "border-l-violet",
    text: "text-violet-300",
    dot: "bg-violet",
    color: "var(--color-violet)",
  },
};

/** "two-pointers" -> "Two Pointers"; labels that are already readable keep their casing. */
export function formatTag(tag: string): string {
  return tag
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
