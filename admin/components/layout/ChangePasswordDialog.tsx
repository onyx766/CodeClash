"use client";

import { useState, type FormEvent } from "react";
import { ApiError, auth } from "../../lib/api";
import { Button, Field, Notice, TextInput } from "../ui/Primitives";
import { Modal } from "../ui/Modal";
import { IconAlert, IconCheckCircle, IconLock } from "../ui/Icons";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Self-service password change (POST /auth/change-password).
 *
 * The server verifies the current password, signs out every other session of
 * the account and re-issues this session's cookies, so the console stays
 * signed in. A wrong current password is a 400 INVALID_CURRENT_PASSWORD - not
 * a 401 - so the API client never mistakes it for an expired session.
 */
export function ChangePasswordDialog({
  email,
  onClose,
}: {
  /** Lets password managers file the new password under the right account. */
  email?: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const nextError =
    next && next.length < MIN_LENGTH
      ? `Use at least ${MIN_LENGTH} characters.`
      : next && next === current
        ? "Choose a password that differs from the current one."
        : null;
  const confirmError =
    confirm && confirm !== next ? "Passwords do not match." : null;
  const valid =
    current.length > 0 &&
    next.length >= MIN_LENGTH &&
    next.length <= MAX_LENGTH &&
    next !== current &&
    confirm === next;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    setCurrentError(null);
    try {
      await auth.changePassword(current, next);
      setDone(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "INVALID_CURRENT_PASSWORD") {
        setCurrentError("Your current password is incorrect.");
      } else {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "The password could not be changed. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Change password"
      description="Signs out your other sessions. This one stays signed in."
      icon={
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-blue/30 bg-blue/12 text-blue-soft">
          <IconLock size={17} />
        </span>
      }
      onClose={onClose}
    >
      {done ? (
        <div className="space-y-4 p-5">
          <Notice tone="green">
            <span className="flex items-start gap-2">
              <IconCheckCircle size={15} className="mt-px shrink-0" />
              Password changed. Any other session on this account has been
              signed out.
            </span>
          </Notice>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4 p-5" onSubmit={submit} noValidate>
          {error ? (
            <Notice tone="rose">
              <span className="flex items-start gap-2">
                <IconAlert size={15} className="mt-px shrink-0" />
                {error}
              </span>
            </Notice>
          ) : null}

          {email ? (
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              hidden
            />
          ) : null}

          <Field
            label="Current password"
            required
            htmlFor="current-password"
            error={currentError}
          >
            <TextInput
              id="current-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              maxLength={MAX_LENGTH}
              value={current}
              invalid={!!currentError}
              onChange={(event) => {
                setCurrent(event.target.value);
                setCurrentError(null);
              }}
            />
          </Field>

          <Field
            label="New password"
            required
            htmlFor="new-password"
            hint={`${MIN_LENGTH}–${MAX_LENGTH} characters.`}
            error={nextError}
          >
            <TextInput
              id="new-password"
              type="password"
              autoComplete="new-password"
              maxLength={MAX_LENGTH}
              value={next}
              invalid={!!nextError}
              onChange={(event) => setNext(event.target.value)}
            />
          </Field>

          <Field
            label="Confirm new password"
            required
            htmlFor="confirm-password"
            error={confirmError}
          >
            <TextInput
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              maxLength={MAX_LENGTH}
              value={confirm}
              invalid={!!confirmError}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!valid}
              icon={<IconLock size={15} />}
            >
              Change password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
