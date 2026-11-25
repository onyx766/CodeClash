"use client";

import { useEffect, useMemo, useState } from "react";
import { Code2, Crown, FlaskConical, RotateCcw, Search, ShieldAlert, ShieldCheck, Timer, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import ChallengesSidebar from "../../components/app/ChallengesSidebar";
import ChallengesRail from "../../components/app/ChallengesRail";
import { IconBadge, Tag } from "../../components/ui/Bits";
import Markdown from "../../components/ui/Markdown";
import { challenges as challengesApi, type CatalogueChallenge } from "../../lib/api";
import type { Difficulty } from "../../lib/battle";
import { DIFFICULTIES, DIFFICULTY_META, formatTag } from "../../lib/difficulty";

type Filter = "ALL" | Difficulty;

const DIFFICULTY_ICON: Record<Difficulty, LucideIcon> = {
  EASY: ShieldCheck,
  MEDIUM: ShieldCheck,
  HARD: ShieldAlert,
  EXPERT: Crown,
};

function signature(c: CatalogueChallenge) {
  const params = c.function.parameters.map((p) => `${p.name}: ${p.type}`).join(", ");
  return `${c.function.name}(${params}) → ${c.function.returnType}`;
}

function formatSeconds(ms: number) {
  return ms % 1000 === 0 ? `${ms / 1000} s` : `${ms} ms`;
}

export default function ChallengesPage() {
  const [catalogue, setCatalogue] = useState<CatalogueChallenge[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<Filter>("ALL");
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    challengesApi.list().then(
      (res) => {
        if (!cancelled) setCatalogue(Array.isArray(res?.challenges) ? res.challenges : []);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (catalogue ?? []).filter(
      (c) =>
        (active === "ALL" || c.difficulty === active) &&
        (!tag || c.tags.includes(tag)) &&
        (!needle ||
          c.title.toLowerCase().includes(needle) ||
          c.tags.some((t) => formatTag(t).toLowerCase().includes(needle))),
    );
  }, [catalogue, active, tag, query]);

  const countFor = (filter: Filter) =>
    filter === "ALL" ? (catalogue?.length ?? 0) : (catalogue ?? []).filter((c) => c.difficulty === filter).length;

  return (
    <AppLayout
      sidebar={<ChallengesSidebar />}
      rail={<ChallengesRail challenges={catalogue} activeTag={tag} onSelectTag={setTag} />}
    >
      <header className="flex items-start gap-3">
        <IconBadge tone="blue" size={40}>
          <Code2 size={19} strokeWidth={2.2} />
        </IconBadge>
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Challenges</h1>
          <p className="mt-1 text-[13px] text-dim">
            The published problems battles are drawn from. Both players get the same set.
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["ALL", ...DIFFICULTIES] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActive(f)}
              aria-pressed={active === f}
              className={`rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                active === f
                  ? "border-blue/40 bg-blue/12 text-blue-300"
                  : "border-line bg-panel text-muted hover:text-fg"
              }`}
            >
              {f === "ALL" ? "All" : DIFFICULTY_META[f].label}
              {catalogue && <span className="ml-1.5 font-normal text-dim">{countFor(f)}</span>}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search challenges…"
            aria-label="Search challenges"
            className="field w-56 !pl-9"
          />
        </div>
      </div>

      {tag && (
        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-dim">
          Tagged
          <button
            type="button"
            onClick={() => setTag(null)}
            className="inline-flex items-center gap-1 rounded-md border border-blue/30 bg-blue/10 px-2 py-[3px] text-[11.5px] font-semibold text-blue-300"
            aria-label={`Remove the ${formatTag(tag)} filter`}
          >
            {formatTag(tag)} <X size={12} />
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {catalogue === null ? (
          failed ? (
            <div className="card p-10 text-center">
              <p className="text-[13px] text-muted">The challenge catalogue could not be loaded.</p>
              <button type="button" onClick={retry} className="btn btn-ghost mt-4 !py-2 !text-[12.5px]">
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          ) : (
            <p className="card p-10 text-center text-[13px] text-dim">Loading challenges…</p>
          )
        ) : catalogue.length === 0 ? (
          <p className="card p-10 text-center text-[13px] text-dim">No challenges have been published yet.</p>
        ) : visible.length === 0 ? (
          <p className="card p-10 text-center text-[13px] text-dim">No challenges match your filters.</p>
        ) : (
          visible.map((c) => {
            const meta = DIFFICULTY_META[c.difficulty];
            const Icon = DIFFICULTY_ICON[c.difficulty];
            return (
              <article key={c.id} className={`card border-l-4 p-4 ${meta.border}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Icon size={14} className={meta.text} strokeWidth={2.2} />
                  <h2 className="text-[16px] font-bold leading-snug">{c.title}</h2>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag tone={meta.tone}>{meta.label}</Tag>
                  {c.tags.map((t) => (
                    <Tag key={t} tone="slate">
                      {formatTag(t)}
                    </Tag>
                  ))}
                </div>

                <Markdown inline className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-dim">
                  {c.description}
                </Markdown>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-dim">
                  <code className="rounded-md bg-black/25 px-2 py-1 font-mono text-[11.5px] text-muted">
                    {signature(c)}
                  </code>
                  <span className="flex items-center gap-1.5">
                    <Timer size={13} /> {formatSeconds(c.limits.timeLimitMs)} · {c.limits.memoryLimitMb} MB per test
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FlaskConical size={13} /> {c.publicTestCount} {c.publicTestCount === 1 ? "example" : "examples"} +
                    hidden tests
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>

      {catalogue && catalogue.length > 0 && (
        <p className="mt-5 text-[12px] text-dim">
          Showing {visible.length} of {catalogue.length} {catalogue.length === 1 ? "challenge" : "challenges"}
        </p>
      )}
    </AppLayout>
  );
}
