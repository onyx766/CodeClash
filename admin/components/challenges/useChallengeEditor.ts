"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../lib/api";
import { challengeService } from "../../services/challenge.service";
import {
  DraftSerializationError,
  draftFromChallenge,
  draftToPayload,
  draftToPresentationPayload,
  emptyDraft,
  type ChallengeDraft,
} from "../../lib/draft";
import type {
  AdminChallenge,
  ChallengeStatus,
  UpsertChallengePayload,
  ValidationCheck,
  ValidationStatus,
} from "../../lib/types";
import type { SaveState } from "./ChallengeActionBar";

/**
 * Editor state for the Create Challenge page.
 *
 * Deliberately explicit Save Draft rather than keystroke autosave: correctness
 * matters more here, and every save carries the full test-case set. A monotonic
 * request counter still guards the async paths so a slow earlier response can
 * never overwrite newer state.
 */
export function useChallengeEditor() {
  const [draft, setDraft] = useState<ChallengeDraft>(emptyDraft);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChallengeStatus | null>(null);

  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>("NOT_CHECKED");
  const [checks, setChecks] = useState<ValidationCheck[]>([]);
  const [validatedAt, setValidatedAt] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    tone: "green" | "rose" | "amber";
    message: string;
  } | null>(null);

  /**
   * Every server response carries the sequence number of the request that
   * produced it; anything older than the latest issued request is discarded.
   */
  const sequence = useRef(0);

  const patch = useCallback((changes: Partial<ChallengeDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setDirty(true);
    setSaveState("dirty");
  }, []);

  /** Replaces the whole draft (AI generate / JSON import / server reload). */
  const replaceDraft = useCallback(
    (next: ChallengeDraft, markDirty = true) => {
      setDraft(next);
      setDirty(markDirty);
      setSaveState(markDirty ? "dirty" : "saved");
    },
    [],
  );

  const applyChallenge = useCallback((challenge: AdminChallenge) => {
    setChallengeId(challenge.id);
    setStatus(challenge.status);
    setValidationStatus(challenge.validation.status);
    setChecks(challenge.validation.checks ?? []);
    setValidatedAt(challenge.validation.validatedAt);
    setDraft(draftFromChallenge(challenge));
    setDirty(false);
    setSavedAt(new Date());
    setSaveState("saved");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const describe = (caught: unknown) =>
    caught instanceof ApiError || caught instanceof DraftSerializationError
      ? caught.message
      : "Something went wrong. Please try again.";

  // -------------------------------------------------------------------------

  const save = useCallback(async (): Promise<AdminChallenge | null> => {
    const ticket = ++sequence.current;
    setSaving(true);
    setSaveState("saving");
    setError(null);

    // A published challenge only takes presentational edits (see
    // draftToPresentationPayload); everything else is sent in full.
    const published = status === "PUBLISHED";
    let payload: UpsertChallengePayload;
    try {
      payload = published
        ? draftToPresentationPayload(draft)
        : draftToPayload(draft);
    } catch (caught) {
      setSaving(false);
      setSaveState("error");
      setError(describe(caught));
      return null;
    }

    try {
      const response = challengeId
        ? await challengeService.updateDraft(challengeId, payload)
        : await challengeService.createDraft(payload);

      if (ticket !== sequence.current) return null;

      applyChallenge(response.challenge);
      setToast({
        tone: "green",
        message: published ? "Changes saved." : "Draft saved.",
      });
      return response.challenge;
    } catch (caught) {
      if (ticket !== sequence.current) return null;
      setSaveState("error");
      setError(describe(caught));
      return null;
    } finally {
      setSaving(false);
    }
  }, [draft, challengeId, status, applyChallenge]);

  const validate = useCallback(async () => {
    if (!challengeId) {
      setValidationError("Save the draft before running validation.");
      return;
    }
    const ticket = ++sequence.current;
    setValidating(true);
    setValidationError(null);

    try {
      const response = await challengeService.validate(challengeId);
      if (ticket !== sequence.current) return;

      setValidationStatus(response.validation.status);
      setChecks(response.validation.checks);
      setValidatedAt(response.validation.validatedAt);
      setToast(
        response.validation.status === "PASSED"
          ? { tone: "green", message: "Validation passed. Ready to publish." }
          : {
              tone: "rose",
              message: "Validation failed. See the checks for details.",
            },
      );
    } catch (caught) {
      if (ticket !== sequence.current) return;
      // A runner that could not be reached is reported as such, not as a
      // failed challenge - the server refuses to record a verdict either.
      setValidationError(describe(caught));
      setToast({ tone: "amber", message: "Validation could not be completed." });
    } finally {
      setValidating(false);
    }
  }, [challengeId]);

  const publish = useCallback(async () => {
    if (!challengeId) return;
    const ticket = ++sequence.current;
    setPublishing(true);
    setError(null);

    try {
      const response = await challengeService.publish(challengeId);
      if (ticket !== sequence.current) return;
      setStatus(response.challenge.status);
      setValidationStatus(response.challenge.validation.status);
      setToast({ tone: "green", message: "Challenge published." });
    } catch (caught) {
      if (ticket !== sequence.current) return;
      setError(describe(caught));
      setToast({ tone: "rose", message: "Publish refused by the server." });
    } finally {
      setPublishing(false);
    }
  }, [challengeId]);

  /**
   * Takes a published challenge out of rotation: new matches stop picking it,
   * while matches already played keep resolving it. Throws when the server
   * refuses, so the confirmation dialog can say why.
   */
  const archive = useCallback(async () => {
    if (!challengeId) return;
    const ticket = ++sequence.current;
    const response = await challengeService.archive(challengeId);
    if (ticket !== sequence.current) return;
    setStatus(response.challenge.status);
    setValidationStatus(response.challenge.validation.status);
    setToast({
      tone: "green",
      message: "Challenge archived. New matches will no longer use it.",
    });
  }, [challengeId]);

  /**
   * Permanently deletes a draft or archived challenge. The server refuses
   * (CHALLENGE_IN_USE) once any match has used it; that error is thrown to the
   * caller.
   */
  const remove = useCallback(async () => {
    if (!challengeId) return;
    ++sequence.current;
    await challengeService.remove(challengeId);
  }, [challengeId]);

  /**
   * Import and AI generation both go through the server first, so what lands
   * here is already a validated draft payload - never raw file or model output.
   */
  const adoptChallenge = useCallback(
    (challenge: AdminChallenge) => {
      applyChallenge(challenge);
      setToast({ tone: "green", message: "Draft imported. Review it below." });
    },
    [applyChallenge],
  );

  /**
   * A validation result only applies to the draft that produced it. On a
   * published challenge only presentational fields can change, and those do
   * not affect a verdict, so its result stays current while it is edited.
   */
  const judgingEditable = status !== "PUBLISHED";
  const validationStale = dirty && judgingEditable && checks.length > 0;

  const effectiveValidationStatus: ValidationStatus = useMemo(
    () => (dirty && judgingEditable ? "NOT_CHECKED" : validationStatus),
    [dirty, judgingEditable, validationStatus],
  );

  return {
    draft,
    patch,
    replaceDraft,
    challengeId,
    status,
    validationStatus: effectiveValidationStatus,
    rawValidationStatus: validationStatus,
    checks,
    validatedAt,
    validationStale,
    dirty,
    savedAt,
    saveState,
    busy: { saving, validating, publishing },
    error,
    validationError,
    toast,
    setToast,
    setError,
    save,
    validate,
    publish,
    archive,
    remove,
    adoptChallenge,
    /** Opens an existing challenge as saved (no toast). */
    loadChallenge: applyChallenge,
  };
}
