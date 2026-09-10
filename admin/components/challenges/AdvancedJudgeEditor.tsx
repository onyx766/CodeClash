"use client";

import { useState } from "react";
import { Badge, Card, SectionHeader, Tabs, Notice } from "../ui/Primitives";
import { CodeEditor } from "../ui/CodeEditor";
import { IconCode, IconShield, IconSliders } from "../ui/Icons";
import type { ChallengeDraft } from "../../lib/draft";

type Slot = "reference" | "checker" | "generator";

const REFERENCE_SAMPLE = `function solve(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return [];
}`;

const CHECKER_SAMPLE = `function check(input, actual, expected) {
  if (!Array.isArray(actual) || actual.length !== 2) {
    return { passed: false, message: 'Expected two indices.' };
  }
  const [i, j] = actual;
  const ok = i !== j && input.nums[i] + input.nums[j] === input.target;
  return {
    passed: ok,
    message: ok ? null : 'Indices do not point to values adding to target.',
  };
}`;

const GENERATOR_SAMPLE = `function generate(seed) {
  // Deterministic: the same seed must always produce the same input.
  let s = seed >>> 0;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const nums = Array.from({ length: 2 + Math.floor(rand() * 6) }, () =>
    Math.floor(rand() * 100),
  );
  return { nums, target: nums[0] + nums[1] };
}`;

/**
 * Challenge-level executable code.
 *
 * Deliberately three editors for the whole challenge rather than one per test
 * case. All of it runs only inside the isolated code runner - never in the API
 * process - and none of it is ever returned by a player-facing endpoint.
 */
export function AdvancedJudgeEditor({
  draft,
  patch,
  disabled,
}: {
  draft: ChallengeDraft;
  patch: (changes: Partial<ChallengeDraft>) => void;
  disabled?: boolean;
}) {
  const [slot, setSlot] = useState<Slot>(
    draft.judgeMethod === "CUSTOM_CHECKER" ? "checker" : "reference",
  );

  const slots: Record<
    Slot,
    {
      label: string;
      value: string;
      onChange: (next: string) => void;
      sample: string;
      required: boolean;
      hint: string;
    }
  > = {
    reference: {
      label: "Reference Solution",
      value: draft.referenceSolutionCode,
      onChange: (referenceSolutionCode) => patch({ referenceSolutionCode }),
      sample: REFERENCE_SAMPLE,
      required: draft.judgeMethod === "REFERENCE",
      hint: "A trusted implementation. Validation runs it against every test case to confirm your expected outputs, and it can derive an expectation for a test that has none.",
    },
    checker: {
      label: "Custom Checker",
      value: draft.customCheckerCode,
      onChange: (customCheckerCode) => patch({ customCheckerCode }),
      sample: CHECKER_SAMPLE,
      required: draft.judgeMethod === "CUSTOM_CHECKER",
      hint: "Receives only (input, actual, expected) and must return { passed: boolean, message: string | null }. Use it when several answers are correct.",
    },
    generator: {
      label: "Test Generator",
      value: draft.testGeneratorCode,
      onChange: (testGeneratorCode) => patch({ testGeneratorCode }),
      sample: GENERATOR_SAMPLE,
      required: false,
      hint: "Optional. generate(seed) must be deterministic — validation runs each seed twice and rejects unseeded Math.random(). Generated tests need a reference solution to supply their expected output.",
    },
  };

  const active = slots[slot];

  return (
    <Card>
      <SectionHeader
        icon={<IconSliders size={17} />}
        title="Advanced Judge"
        description="Challenge-level code. Executed only inside the isolated runner."
        accent="amber"
        action={
          <Badge tone="neutral">
            <IconShield size={12} />
            Never sent to players
          </Badge>
        }
      />

      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs<Slot>
            value={slot}
            onChange={setSlot}
            tabs={[
              {
                value: "reference",
                label: (
                  <>
                    Reference Solution
                    {draft.referenceSolutionCode.trim() ? (
                      <span className="size-1.5 rounded-full bg-green" />
                    ) : null}
                  </>
                ),
              },
              {
                value: "checker",
                label: (
                  <>
                    Custom Checker
                    {draft.customCheckerCode.trim() ? (
                      <span className="size-1.5 rounded-full bg-green" />
                    ) : null}
                  </>
                ),
              },
              {
                value: "generator",
                label: (
                  <>
                    Test Generator
                    {draft.testGeneratorCode.trim() ? (
                      <span className="size-1.5 rounded-full bg-green" />
                    ) : null}
                  </>
                ),
              },
            ]}
          />
          {active.required ? <Badge tone="amber">Required</Badge> : null}
        </div>

        {active.required && !active.value.trim() ? (
          <Notice tone="amber">
            The selected judge method requires this code before the challenge can
            be validated.
          </Notice>
        ) : null}

        <CodeEditor
          value={active.value}
          onChange={active.onChange}
          label={`${active.label} (JavaScript)`}
          readOnly={disabled}
          minRows={10}
          maxHeight={460}
          invalid={active.required && !active.value.trim()}
          placeholder={active.sample}
          toolbar={
            <button
              type="button"
              disabled={disabled}
              onClick={() => active.onChange(active.sample)}
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-dim transition-colors hover:text-blue-soft"
            >
              <IconCode size={12} />
              Insert example
            </button>
          }
        />

        <p className="field-hint">{active.hint}</p>
      </div>
    </Card>
  );
}
