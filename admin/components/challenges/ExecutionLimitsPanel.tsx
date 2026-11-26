"use client";

import { Card, Field, NumberInput, SectionHeader } from "../ui/Primitives";
import { IconClock, IconSettings } from "../ui/Icons";
import { LIMITS, type ChallengeDraft } from "../../lib/draft";

/**
 * Per-test-case execution limits, enforced by the runner's container
 * (memory/CPU) and the runtime itself (time/output). Deliberately separate from
 * the round duration, which is how long players get to write a solution.
 */
export function ExecutionLimitsPanel({
  draft,
  patch,
  disabled,
}: {
  draft: ChallengeDraft;
  patch: (changes: Partial<ChallengeDraft>) => void;
  disabled?: boolean;
}) {
  const out = (value: number, key: keyof typeof LIMITS) =>
    value < LIMITS[key].min || value > LIMITS[key].max;

  return (
    <Card>
      <SectionHeader
        icon={<IconSettings size={17} />}
        title="Execution Limits"
        description="Applied per test case by the sandbox."
        accent="blue"
      />

      <div className="space-y-4 p-5">
        <Field
          label="Time Limit (ms)"
          required
          htmlFor="limit-time"
          hint={`Maximum execution time per test case (${LIMITS.timeLimitMs.min}–${LIMITS.timeLimitMs.max}).`}
          error={out(draft.timeLimitMs, "timeLimitMs") ? "Out of range" : null}
        >
          <NumberInput
            id="limit-time"
            value={draft.timeLimitMs}
            min={LIMITS.timeLimitMs.min}
            max={LIMITS.timeLimitMs.max}
            step={LIMITS.timeLimitMs.step}
            invalid={out(draft.timeLimitMs, "timeLimitMs")}
            disabled={disabled}
            onChange={(timeLimitMs) => !disabled && patch({ timeLimitMs })}
          />
        </Field>

        <Field
          label="Memory Limit (MB)"
          required
          htmlFor="limit-memory"
          hint={`Maximum memory per test case (${LIMITS.memoryLimitMb.min}–${LIMITS.memoryLimitMb.max}).`}
          error={out(draft.memoryLimitMb, "memoryLimitMb") ? "Out of range" : null}
        >
          <NumberInput
            id="limit-memory"
            value={draft.memoryLimitMb}
            min={LIMITS.memoryLimitMb.min}
            max={LIMITS.memoryLimitMb.max}
            step={LIMITS.memoryLimitMb.step}
            invalid={out(draft.memoryLimitMb, "memoryLimitMb")}
            disabled={disabled}
            onChange={(memoryLimitMb) => !disabled && patch({ memoryLimitMb })}
          />
        </Field>

        <Field
          label="Output Limit (KB)"
          required
          htmlFor="limit-output"
          hint={`Maximum size of program output (${LIMITS.outputLimitKb.min}–${LIMITS.outputLimitKb.max}).`}
          error={out(draft.outputLimitKb, "outputLimitKb") ? "Out of range" : null}
        >
          <NumberInput
            id="limit-output"
            value={draft.outputLimitKb}
            min={LIMITS.outputLimitKb.min}
            max={LIMITS.outputLimitKb.max}
            step={LIMITS.outputLimitKb.step}
            invalid={out(draft.outputLimitKb, "outputLimitKb")}
            disabled={disabled}
            onChange={(outputLimitKb) => !disabled && patch({ outputLimitKb })}
          />
        </Field>

        <div className="flex items-start gap-2 rounded-[10px] border border-line bg-panel-2/50 p-3">
          <IconClock size={14} className="mt-0.5 shrink-0 text-dim" />
          <p className="text-[11px] leading-4 text-dim">
            These are per-test execution limits, not the round timer. How long
            players get to write a solution is the round duration, set on the
            match.
          </p>
        </div>
      </div>
    </Card>
  );
}
