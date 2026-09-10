"use client";

import { Badge, Button, cx } from "../ui/Primitives";
import {
  IconEye,
  IconPlay,
  IconRocket,
  IconSave,
  IconSpinner,
} from "../ui/Icons";
import type { ChallengeStatus, ValidationStatus } from "../../lib/types";

export type SaveState = "idle" | "saving" | "saved" | "dirty" | "error";

/**
 * Sticky bottom bar.
 *
 * Publish is disabled until the server has recorded a PASSED validation for the
 * saved draft, but that is a convenience: the publish endpoint independently
 * refuses a challenge that is unvalidated, or whose judging fingerprint moved
 * after validation, so nothing here can be bypassed from the browser.
 */
export function ChallengeActionBar({
  status,
  validationStatus,
  saveState,
  savedAt,
  challengeId,
  dirty,
  busy,
  onSave,
  onValidate,
  onPreview,
  onPublish,
}: {
  status: ChallengeStatus | null;
  validationStatus: ValidationStatus;
  saveState: SaveState;
  savedAt: Date | null;
  challengeId: string | null;
  dirty: boolean;
  busy: { saving: boolean; validating: boolean; publishing: boolean };
  onSave: () => void;
  onValidate: () => void;
  onPreview: () => void;
  onPublish: () => void;
}) {
  const canValidate = !!challengeId && !dirty && !busy.validating;
  const canPublish =
    !!challengeId &&
    !dirty &&
    validationStatus === "PASSED" &&
    status !== "PUBLISHED";

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : dirty
        ? "Unsaved changes"
        : savedAt
          ? `Saved ${savedAt.toLocaleTimeString()}`
          : "Not saved yet";

  return (
    <div className="sticky bottom-0 z-20 border-t border-line bg-[rgba(7,11,24,0.92)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cx(
              "size-1.5 shrink-0 rounded-full",
              saveState === "saving"
                ? "bg-amber"
                : dirty
                  ? "bg-amber"
                  : savedAt
                    ? "bg-green"
                    : "bg-dim",
            )}
          />
          <span className="truncate text-[12px] text-dim">{saveLabel}</span>
          {status ? (
            <Badge
              tone={
                status === "PUBLISHED"
                  ? "green"
                  : status === "ARCHIVED"
                    ? "neutral"
                    : "blue"
              }
            >
              {status}
            </Badge>
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            icon={<IconSave size={15} />}
            loading={busy.saving}
            onClick={onSave}
          >
            Save Draft
          </Button>

          <Button
            icon={busy.validating ? undefined : <IconPlay size={14} />}
            loading={busy.validating}
            disabled={!canValidate}
            title={
              !challengeId
                ? "Save the draft first"
                : dirty
                  ? "Save your changes before validating"
                  : undefined
            }
            onClick={onValidate}
          >
            Validate Problem
          </Button>

          <Button icon={<IconEye size={15} />} onClick={onPreview}>
            Preview
          </Button>

          <Button
            variant="primary"
            icon={busy.publishing ? undefined : <IconRocket size={15} />}
            loading={busy.publishing}
            disabled={!canPublish}
            title={
              status === "PUBLISHED"
                ? "Already published"
                : !challengeId
                  ? "Save the draft first"
                  : dirty
                    ? "Save and re-validate before publishing"
                    : validationStatus !== "PASSED"
                      ? "Validation must pass before publishing"
                      : undefined
            }
            onClick={onPublish}
          >
            {busy.publishing ? <IconSpinner size={15} /> : null}
            Publish Challenge
          </Button>
        </div>
      </div>
    </div>
  );
}
