import { RotateCcw } from "lucide-react";
import { Panel } from "../ui/Bits";
import type { CatalogueChallenge } from "../../lib/api";
import { DIFFICULTIES, DIFFICULTY_META, formatTag } from "../../lib/difficulty";

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function DifficultyRing({ counts, total }: { counts: { color: string; count: number }[]; total: number }) {
  // Each difficulty is an arc whose length is its share of the catalogue.
  const arcs = counts
    .filter((c) => c.count > 0)
    .reduce<{ color: string; length: number; offset: number }[]>((acc, c) => {
      const previous = acc[acc.length - 1];
      acc.push({
        color: c.color,
        length: (c.count / total) * RING_LENGTH,
        offset: previous ? previous.offset + previous.length : 0,
      });
      return acc;
    }, []);

  return (
    <div className="relative mx-auto h-[144px] w-[144px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="9" />
        {arcs.map((arc) => (
          <circle
            key={arc.color}
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, arc.length - 3)} ${RING_LENGTH - arc.length + 3}`}
            strokeDashoffset={-arc.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold leading-none">{total}</span>
        <span className="mt-1 text-[11px] text-dim">Challenges</span>
      </div>
    </div>
  );
}

/** Catalogue breakdown by difficulty, and its tags as filters. */
export default function ChallengesRail({
  challenges,
  failed = false,
  onRetry,
  activeTag,
  onSelectTag,
}: {
  /** null until the catalogue has loaded. */
  challenges: CatalogueChallenge[] | null;
  /** The catalogue could not be loaded. */
  failed?: boolean;
  onRetry?: () => void;
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
}) {
  const list = challenges ?? [];
  const counts = DIFFICULTIES.map((difficulty) => ({
    difficulty,
    ...DIFFICULTY_META[difficulty],
    count: list.filter((c) => c.difficulty === difficulty).length,
  }));

  const tagCounts = new Map<string, number>();
  for (const challenge of list) {
    for (const tag of challenge.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <>
      <Panel title="Catalogue">
        {challenges === null ? (
          failed ? (
            <div>
              <p className="text-[12px] text-dim">The catalogue could not be loaded.</p>
              {onRetry && (
                <button type="button" onClick={onRetry} className="btn btn-ghost mt-3 !py-2 !text-[12px]">
                  <RotateCcw size={13} /> Try again
                </button>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-dim">Loading…</p>
          )
        ) : (
          <>
            <DifficultyRing counts={counts} total={list.length} />
            <div className="mt-5 space-y-2.5">
              {counts.map((c) => (
                <div key={c.difficulty} className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-2 text-muted">
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                    {c.label}
                  </span>
                  <span className="font-semibold text-fg">{c.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {tags.length > 0 && (
        <Panel
          title="Tags"
          action={
            activeTag ? (
              <button type="button" onClick={() => onSelectTag(null)} className="link-quiet">
                Show all
              </button>
            ) : undefined
          }
          bodyClassName="space-y-1"
        >
          {tags.map(([tag, count]) => {
            const active = tag === activeTag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(active ? null : tag)}
                aria-pressed={active}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                  active ? "bg-blue/12 text-blue-300" : "text-muted hover:text-fg"
                }`}
              >
                <span>{formatTag(tag)}</span>
                <span className={active ? "text-blue-300" : "text-dim"}>{count}</span>
              </button>
            );
          })}
        </Panel>
      )}
    </>
  );
}
