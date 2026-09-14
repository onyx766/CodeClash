"use client";

import { Badge, Button, Card, Notice, SectionHeader, cx } from "../ui/Primitives";
import {
  IconAlert,
  IconCheckCircle,
  IconMatches,
  IconMinusCircle,
  IconPlay,
  IconSpinner,
  IconSystem,
  IconXCircle,
} from "../ui/Icons";
import { DIFFICULTIES } from "../../lib/draft";
import type {
  BattlePool,
  BattlePoolChallenge,
  BatchOutcome,
  BatchValidationResponse,
} from "../../lib/types";

const OUTCOME_TONE: Record<BatchOutcome, "green" | "rose" | "amber" | "neutral"> = {
  PASSED: "green",
  FAILED: "rose",
  ERROR: "amber",
  SKIPPED: "neutral",
};

function RunnerHelp() {
  return (
    <Notice tone="amber">
      <span className="flex items-start gap-2">
        <IconAlert size={15} className="mt-px shrink-0" />
        <span>
          Checks run the reference solution and every test inside the isolated code runner, and it is not
          reachable right now, so no challenge can be validated. Start it with{" "}
          <span className="mono">docker compose up code-runner runner-worker dind</span>. For local development
          only, <span className="mono">MATCH_REQUIRE_VALIDATED_CHALLENGES=false</span> in{" "}
          <span className="mono">backend/.env</span> lets battles use unvalidated challenges.
        </span>
      </span>
    </Notice>
  );
}

/**
 * The battle pool at a glance: can a match start, how the eligible challenges
 * split by difficulty, and whether the runner that validates them is up.
 * Every number comes from GET /admin/challenges/battle-pool.
 */
export function BattlePoolPanel({
  pool,
  error,
  refreshing,
  batch,
  batchRunning,
  onRefresh,
  onValidatePublished,
}: {
  pool: BattlePool | null;
  error: string | null;
  refreshing: boolean;
  batch: BatchValidationResponse | null;
  batchRunning: boolean;
  onRefresh: () => void;
  onValidatePublished: () => void;
}) {
  const preferred = pool
    ? DIFFICULTIES.filter((d) => pool.distribution[d.value] > 0)
        .map((d) => `${pool.distribution[d.value]} ${d.label}`)
        .join(" / ")
    : "";

  return (
    <Card>
      <SectionHeader
        icon={<IconMatches size={17} />}
        title="Battle Pool"
        description={
          pool
            ? `Every match draws ${pool.challengeCount} distinct eligible challenges (preferring ${preferred}; gaps are filled from the nearest difficulty).`
            : "Challenges that matches can draw from."
        }
        accent="violet"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" loading={refreshing} onClick={onRefresh}>
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={batchRunning}
              icon={batchRunning ? undefined : <IconPlay size={13} />}
              disabled={!pool || pool.needsValidationCount === 0 || !pool.runner.reachable}
              title={
                !pool
                  ? undefined
                  : !pool.runner.reachable
                    ? "The code runner is not reachable"
                    : pool.needsValidationCount === 0
                      ? "Every published challenge has passed validation"
                      : undefined
              }
              onClick={onValidatePublished}
            >
              Check unvalidated ({pool?.needsValidationCount ?? 0})
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-5">
        {error ? <Notice tone="rose">{error}</Notice> : null}

        {!pool && !error ? (
          <p className="flex items-center gap-2 text-[12px] text-dim">
            <IconSpinner size={14} /> Loading battle pool…
          </p>
        ) : null}

        {pool ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_1.2fr]">
              <div
                className={cx(
                  "rounded-[10px] border px-3 py-2.5",
                  pool.canStartMatch ? "border-green/30 bg-green/8" : "border-rose/30 bg-rose/8",
                )}
              >
                <p className="eyebrow">Matches</p>
                <p
                  className={cx(
                    "mt-1 flex items-center gap-1.5 text-[14px] font-bold",
                    pool.canStartMatch ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {pool.canStartMatch ? <IconCheckCircle size={15} /> : <IconXCircle size={15} />}
                  {pool.canStartMatch ? "Can start" : "Cannot start"}
                </p>
                <p className="mt-0.5 text-[11.5px] text-dim">
                  {pool.eligibleCount} of {pool.challengeCount} needed challenges eligible
                </p>
              </div>

              {DIFFICULTIES.map((d) => {
                const have = pool.eligibleByDifficulty[d.value] ?? 0;
                const want = pool.distribution[d.value] ?? 0;
                return (
                  <div key={d.value} className="rounded-[10px] border border-line bg-panel-2/50 px-3 py-2.5">
                    <p className="eyebrow flex items-center gap-1.5">
                      <span className={cx("size-1.5 rounded-full", d.tone)} />
                      {d.label}
                    </p>
                    <p className={cx("mt-1 text-[18px] font-bold", have < want ? "text-amber-300" : "text-fg")}>
                      {have}
                    </p>
                    <p className="text-[11px] text-dim">eligible · prefers {want}</p>
                  </div>
                );
              })}

              <div className="rounded-[10px] border border-line bg-panel-2/50 px-3 py-2.5">
                <p className="eyebrow flex items-center gap-1.5">
                  <IconSystem size={12} /> Code runner
                </p>
                <p className="mt-1">
                  <Badge tone={pool.runner.reachable ? "green" : "rose"}>
                    {pool.runner.reachable ? "Online" : "Offline"}
                  </Badge>
                </p>
                <p className="mt-1 text-[11px] text-dim">
                  {pool.runner.workers === null ? "Workers unknown" : `${pool.runner.workers} worker(s) registered`}
                </p>
              </div>
            </div>

            <p className="text-[11.5px] text-dim">
              Validation {pool.requireValidated ? "is required" : "is NOT required (development override)"} for a
              challenge to be used in battles · match clock {pool.durationMinutes} min.
            </p>

            {!pool.runner.reachable ? <RunnerHelp /> : null}

            {pool.requireValidated && pool.needsValidationCount > 0 && pool.runner.reachable ? (
              <Notice tone="amber">
                {pool.needsValidationCount} published challenge(s) have not passed validation, so battles skip them.
                Use “Check unvalidated”, or open a challenge and run its checks.
              </Notice>
            ) : null}

            {batch ? (
              <div className="rounded-[10px] border border-line">
                <p className="border-b border-line px-3 py-2 text-[12px] font-semibold text-muted">
                  Last run: {batch.summary.PASSED} passed · {batch.summary.FAILED} failed · {batch.summary.ERROR}{" "}
                  errors · {batch.summary.SKIPPED} skipped
                </p>
                <ul className="max-h-60 divide-y divide-line-soft overflow-y-auto">
                  {batch.results.map((result) => (
                    <li key={result.id} className="flex items-start gap-3 px-3 py-2">
                      <Badge tone={OUTCOME_TONE[result.outcome]} className="w-[74px] justify-center">
                        {result.outcome}
                      </Badge>
                      <span className="min-w-0 flex-1">
                        <a href={`/challenges/${result.id}`} className="text-[12.5px] font-semibold text-fg hover:underline">
                          {result.title}
                        </a>
                        {result.message ? (
                          <span className="mt-0.5 block text-[11.5px] text-dim">{result.message}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                  {batch.results.length === 0 ? (
                    <li className="px-3 py-3 text-[12px] text-dim">Nothing needed checking.</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

/** Small cell used in the challenge list. */
export function BattleEligibilityBadge({ entry }: { entry?: BattlePoolChallenge }) {
  if (!entry) return <span className="text-[11px] text-faint">—</span>;
  if (entry.eligible) {
    return (
      <Badge tone="green" className="w-fit">
        <IconCheckCircle size={12} /> Eligible
      </Badge>
    );
  }
  return (
    <span title={entry.problems.join(" ")} className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-amber-300">
      <IconMinusCircle size={13} className="shrink-0" />
      <span className="truncate">{entry.problems[0]}</span>
    </span>
  );
}

/** Detail-page card: is this challenge in the battle pool, and if not, why. */
export function BattleEligibilityCard({
  entry,
  pool,
}: {
  entry: BattlePoolChallenge | null;
  pool: BattlePool | null;
}) {
  return (
    <Card>
      <SectionHeader
        icon={<IconMatches size={17} />}
        title="Battle Eligibility"
        description="Whether matches can draw this challenge."
        accent="violet"
      />
      <div className="space-y-3 p-5">
        {!entry || !pool ? (
          <p className="flex items-center gap-2 text-[12px] text-dim">
            <IconSpinner size={14} /> Checking…
          </p>
        ) : entry.eligible ? (
          <Notice tone="green">
            <span className="flex items-center gap-2">
              <IconCheckCircle size={15} /> In the battle pool.
            </span>
          </Notice>
        ) : (
          <Notice tone="amber">
            <p className="font-semibold">Not used in battles:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {entry.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Notice>
        )}
        {pool && !pool.runner.reachable ? <RunnerHelp /> : null}
      </div>
    </Card>
  );
}
