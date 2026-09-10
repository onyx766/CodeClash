"use client";

import { Card, Notice, OptionCard, SectionHeader } from "../ui/Primitives";
import { IconAlert, IconCode, IconFlask, IconScale, IconShield } from "../ui/Icons";
import { JUDGE_METHODS, type ChallengeDraft } from "../../lib/draft";
import type { JudgeMethod } from "../../lib/types";

const ICONS: Record<JudgeMethod, typeof IconScale> = {
  EXACT: IconScale,
  DEEP_EQUAL: IconFlask,
  CUSTOM_CHECKER: IconCode,
  REFERENCE: IconShield,
};

/**
 * Choosing a judge method reveals the advanced editor it needs; the server
 * refuses to validate a challenge whose method has no matching code, so the
 * hint here is a shortcut, not the enforcement.
 */
export function JudgeMethodSelector({
  draft,
  patch,
  disabled,
}: {
  draft: ChallengeDraft;
  patch: (changes: Partial<ChallengeDraft>) => void;
  disabled?: boolean;
}) {
  const missingChecker =
    draft.judgeMethod === "CUSTOM_CHECKER" && !draft.customCheckerCode.trim();
  const missingReference =
    draft.judgeMethod === "REFERENCE" && !draft.referenceSolutionCode.trim();

  return (
    <Card>
      <SectionHeader
        icon={<IconScale size={17} />}
        title="Judge Method"
        description="Choose how submissions will be evaluated."
        accent="teal"
      />

      <div
        role="radiogroup"
        aria-label="Judge method"
        className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {JUDGE_METHODS.map((method) => {
          const Icon = ICONS[method.value];
          return (
            <OptionCard
              key={method.value}
              name="judge-method"
              selected={draft.judgeMethod === method.value}
              onSelect={() => patch({ judgeMethod: method.value })}
              icon={<Icon size={17} />}
              accent={method.accent}
              title={method.title}
              description={method.description}
              disabled={disabled}
            />
          );
        })}
      </div>

      {missingChecker || missingReference ? (
        <div className="px-5 pb-5">
          <Notice tone="amber">
            <span className="flex items-start gap-2">
              <IconAlert size={15} className="mt-px shrink-0" />
              {missingChecker
                ? "Add checker code in Advanced Judge below — this method cannot be validated without it."
                : "Add a reference solution in Advanced Judge below — this method cannot be validated without it."}
            </span>
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}
