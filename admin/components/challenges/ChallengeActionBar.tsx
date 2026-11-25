"use client";

import { Badge, Button, cx } from "../ui/Primitives";
import {
  IconArchive,
  IconEye,
  IconPlay,
  IconRocket,
  IconSave,
  IconTrash,
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
 *
 * Lifecycle: a PUBLISHED challenge can be archived (taken out of rotation; it
 * can be published again later), and a DRAFT or ARCHIVED one deleted. The
 * server refuses to delete anything a match has used. Only one operation runs
 * at a time, so a slow response can never land on top of a newer one.
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
  onArchive,
  onDelete,
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
  onArchive: () => void;
  onDelete: () => void;
}) {
  const idle = !busy.saving && !busy.validating && !busy.publishing;
  const canValidate = !!challengeId && !dirty && idle;
  const canPublish =
    !!challengeId &&
    !dirty &&
    idle &&
    validationStatus === "PASSED" &&
    status !== "PUBLISHED";
  const canArchive = !!challengeId && status === "PUBLISHED";
  const canDelete =
    !!challengeId && (status === "DRAFT" || status === "ARCHIVED");

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
          {canArchive ? (
            <Button
              variant="ghost"
              icon={<IconArchive size={15} />}
              disabled={!idle}
              title="Take this challenge out of rotation"
              onClick={onArchive}
            >
              Archive
            </Button>
          ) : null}

          {canDelete ? (
            <Button
              variant="ghost"
              icon={<IconTrash size={15} />}
              disabled={!idle}
              title="Delete this challenge permanently"
              className="hover:text-rose-300"
              onClick={onDelete}
            >
              Delete
            </Button>
          ) : null}

          <Button
            icon={<IconSave size={15} />}
            loading={busy.saving}
            disabled={!idle}
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
            {status === "ARCHIVED" ? "Republish Challenge" : "Publish Challenge"}
          </Button>
        </div>
      </div>
    </div>
  );
}
