"use client";

import { useEffect } from "react";
import { Badge, Button, cx } from "../ui/Primitives";
import { IconEye, IconShield } from "../ui/Icons";
import { DIFFICULTIES, type ChallengeDraft } from "../../lib/draft";

/**
 * Approximation of the player view.
 *
 * Renders only what toPublicChallenge() would return: title, description,
 * difficulty, tags, the function signature, starter code and the PUBLIC test
 * cases. Hidden tests, the reference solution, the checker and the generator
 * are not read here at all.
 */
export function PreviewDialog({
  draft,
  onClose,
}: {
  draft: ChallengeDraft;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const publicTests = draft.testCases.filter((test) => !test.isHidden);
  const difficulty = DIFFICULTIES.find((d) => d.value === draft.difficulty);
  const signature = `${draft.functionName || "solve"}(${draft.parameters
    .map((parameter) => parameter.name.trim())
    .filter(Boolean)
    .join(", ")})`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Player preview"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
    >
      <button
        type="button"
        aria-label="Close preview"
        className="fixed inset-0 -z-10 cursor-default"
        onClick={onClose}
      />

      <div className="panel my-auto w-full max-w-3xl overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[9px] border border-blue/25 bg-blue/12 text-blue-soft">
              <IconEye size={16} />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold">Player Preview</p>
              <p className="text-[11px] text-dim">
                Approximately what a player sees during a round.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-bold tracking-tight">
                {draft.title || "Untitled challenge"}
              </h2>
              <span
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-semibold text-muted",
                )}
              >
                <span className={cx("size-1.5 rounded-full", difficulty?.tone)} />
                {difficulty?.label}
              </span>
              {draft.tags.map((tag) => (
                <Badge key={tag} tone="blue">
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="mono mt-1 text-[11.5px] text-dim">/{draft.slug}</p>
          </div>

          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-muted">
            {draft.description || "No description yet."}
          </p>

          <div>
            <p className="eyebrow">Function signature</p>
            <p className="mono mt-1 text-[13px] text-blue-soft">
              {signature} → {draft.returnType}
            </p>
          </div>

          <div>
            <p className="eyebrow">Starter code</p>
            <pre className="mono mt-1.5 overflow-x-auto rounded-[10px] border border-line bg-[rgba(3,6,14,0.7)] p-3 text-[12px] leading-5 text-fg">
              {draft.starterCode}
            </pre>
          </div>

          <div>
            <p className="eyebrow">Examples ({publicTests.length})</p>
            {publicTests.length === 0 ? (
              <p className="mt-1.5 text-[12px] text-dim">
                No public test cases yet.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-2">
                {publicTests.map((testCase, index) => (
                  <li
                    key={testCase.key}
                    className="rounded-[10px] border border-line bg-panel-2/40 p-3"
                  >
                    <p className="eyebrow">Example {index + 1}</p>
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] text-dim">Input</p>
                        <pre className="mono mt-0.5 overflow-x-auto text-[11.5px] text-fg">
                          {testCase.inputText}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[11px] text-dim">Output</p>
                        <pre className="mono mt-0.5 overflow-x-auto text-[11.5px] text-fg">
                          {testCase.expectedText}
                        </pre>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-[10px] border border-line bg-panel-2/50 p-3">
            <IconShield size={14} className="mt-0.5 shrink-0 text-dim" />
            <p className="text-[11px] leading-4 text-dim">
              Hidden test cases, the reference solution, the custom checker and
              the test generator are not part of this preview because they are
              never sent to a player.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
