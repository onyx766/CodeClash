"use client";

import { useState } from "react";
import { Badge, Button, Card, Notice, SectionHeader, cx } from "../ui/Primitives";
import {
  IconAlert,
  IconCheckCircle,
  IconMinusCircle,
  IconPlay,
  IconSpinner,
  IconXCircle,
} from "../ui/Icons";
import type { ValidationCheck, ValidationStatus } from "../../lib/types";

const CHECK_LABELS: Record<string, string> = {
  CHALLENGE_SCHEMA: "Challenge schema",
  FUNCTION_CONTRACT: "Function contract",
  EXECUTION_LIMITS: "Execution limits",
  JUDGE_CONFIGURATION: "Judge configuration",
  TEST_COUNTS: "Test counts",
  STARTER_CODE: "Starter code",
  REFERENCE_SOLUTION: "Reference solution",
  CUSTOM_CHECKER: "Custom checker",
  PUBLIC_TESTS: "Public tests",
  HIDDEN_TESTS: "Hidden tests",
  GENERATOR: "Test generator",
  GENERATOR_DETERMINISM: "Generator determinism",
  READY_TO_PUBLISH: "Ready to publish",
};

/**
 * Renders the result of a server-side validation run.
 *
 * Everything shown here came back from the backend after it handed the
 * challenge to the isolated runner - nothing on this page decides a verdict,
 * and "not checked yet" is shown as exactly that rather than as a pass.
 */
export function ValidationStatusPanel({
  status,
  checks,
  validatedAt,
  running,
  stale,
  error,
  onValidate,
}: {
  status: ValidationStatus;
  checks: ValidationCheck[];
  validatedAt: string | null;
  running: boolean;
  /** The draft has unsaved edits, so any recorded result is out of date. */
  stale: boolean;
  error: string | null;
  onValidate: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const tone =
    running || stale
      ? "amber"
      : status === "PASSED"
        ? "green"
        : status === "FAILED"
          ? "rose"
          : "neutral";

  const headline = running
    ? "Checking…"
    : stale
      ? "Out of date"
      : status === "PASSED"
        ? "Passed"
        : status === "FAILED"
          ? "Failed"
          : "Not checked";

  return (
    <Card>
      <SectionHeader
        icon={<IconCheckCircle size={17} />}
        title="Validation Status"
        description="Run by the server against the isolated code runner."
        accent="teal"
        action={
          <Button
            size="sm"
            variant="secondary"
            loading={running}
            icon={running ? undefined : <IconPlay size={13} />}
            onClick={onValidate}
          >
            Run checks
          </Button>
        }
      />

      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-panel-2/50 px-3 py-2.5">
          <span className="text-[12px] font-semibold text-muted">Status</span>
          <Badge tone={tone}>
            {running ? <IconSpinner size={12} /> : null}
            {headline}
          </Badge>
        </div>

        {error ? (
          <Notice tone="rose">
            <span className="flex items-start gap-2">
              <IconAlert size={15} className="mt-px shrink-0" />
              {error}
            </span>
          </Notice>
        ) : null}

        {stale && !running && checks.length > 0 ? (
          <Notice tone="amber">
            This challenge changed after it was validated. Save and run the
            checks again before publishing.
          </Notice>
        ) : null}

        {checks.length === 0 && !error ? (
          <p className="rounded-[10px] border border-dashed border-line px-3 py-6 text-center text-[12px] text-dim">
            No checks have run yet. Save the draft, then run Validate Problem.
          </p>
        ) : null}

        <ul className="space-y-1">
          {checks.map((check) => {
            const label = CHECK_LABELS[check.name] ?? check.name;
            const skipped = check.skipped;
            const failed = !check.passed;
            const detail = check.failures?.length ? check.failures[0] : null;
            const isOpen = expanded === check.name;

            return (
              <li key={check.name}>
                <button
                  type="button"
                  disabled={!detail && !check.message}
                  onClick={() => setExpanded(isOpen ? null : check.name)}
                  className={cx(
                    "flex w-full items-start gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors",
                    detail || check.message
                      ? "hover:bg-panel-2"
                      : "cursor-default",
                  )}
                >
                  <span
                    className={cx(
                      "mt-px shrink-0",
                      failed
                        ? "text-rose"
                        : skipped
                          ? "text-dim"
                          : "text-emerald-400",
                    )}
                  >
                    {failed ? (
                      <IconXCircle size={15} />
                    ) : skipped ? (
                      <IconMinusCircle size={15} />
                    ) : (
                      <IconCheckCircle size={15} />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className={cx(
                          "text-[12.5px] font-semibold",
                          failed ? "text-rose-200" : "text-fg",
                        )}
                      >
                        {label}
                      </span>
                      {typeof check.passedCount === "number" &&
                      typeof check.totalCount === "number" ? (
                        <span className="mono text-[11px] text-dim">
                          {check.passedCount}/{check.totalCount}
                        </span>
                      ) : null}
                      {skipped ? <Badge tone="neutral">Skipped</Badge> : null}
                    </span>
                    {check.message ? (
                      <span
                        className={cx(
                          "mt-0.5 block text-[11.5px] leading-[1.45]",
                          failed ? "text-rose-300/90" : "text-dim",
                          isOpen ? "" : "line-clamp-2",
                        )}
                      >
                        {check.message}
                      </span>
                    ) : null}
                  </span>
                </button>

                {isOpen && detail ? (
                  <div className="mx-2.5 mb-2 space-y-2 rounded-[9px] border border-line bg-[rgba(3,6,14,0.6)] p-3">
                    <p className="eyebrow">
                      Test #{detail.order + 1} · {detail.status}
                      {detail.hidden ? " · hidden" : ""}
                    </p>
                    <FailureRow label="Input" value={detail.input} />
                    <FailureRow label="Expected" value={detail.expectedOutput} />
                    <FailureRow
                      label="Reference returned"
                      value={detail.actualOutput}
                    />
                    {detail.message ? (
                      <p className="text-[11.5px] text-rose-300">{detail.message}</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {validatedAt && !running ? (
          <p className="text-[11px] text-faint">
            Last run {new Date(validatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function FailureRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <pre className="mono mt-0.5 overflow-x-auto rounded-[6px] bg-[rgba(9,14,28,0.7)] px-2 py-1.5 text-[11px] leading-4 text-muted">
        {JSON.stringify(value ?? null)}
      </pre>
    </div>
  );
}
