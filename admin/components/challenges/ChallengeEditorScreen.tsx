"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import { challengeService } from "../../services/challenge.service";
import { useRequireAdmin } from "../../hooks/useAdminAuth";
import { AdminShell } from "../layout/AdminShell";
import { Badge, Button, Notice, cx } from "../ui/Primitives";
import { ConfirmDialog } from "../ui/Modal";
import { IconArchive, IconSpinner, IconTrash, IconTrophy } from "../ui/Icons";
import { CreationModeSelector, type CreationMode } from "./CreationModeSelector";
import { BasicInformationSection } from "./BasicInformationSection";
import { FunctionContractEditor } from "./FunctionContractEditor";
import { JudgeMethodSelector } from "./JudgeMethodSelector";
import { TestCasesEditor } from "./TestCasesEditor";
import { AdvancedJudgeEditor } from "./AdvancedJudgeEditor";
import { ExecutionLimitsPanel } from "./ExecutionLimitsPanel";
import { ValidationStatusPanel } from "./ValidationStatusPanel";
import { ChallengeActionBar } from "./ChallengeActionBar";
import { AiGeneratePanel } from "./AiGeneratePanel";
import { JsonImportPanel } from "./JsonImportPanel";
import { PreviewDialog } from "./PreviewDialog";
import { BattleEligibilityCard } from "./BattlePoolPanel";
import { useChallengeEditor } from "./useChallengeEditor";
import { draftFromPayload, draftIssues } from "../../lib/draft";
import type { AiGenerateRequest, BattlePool } from "../../lib/types";

const VALIDATION_TONE = { PASSED: "green", FAILED: "rose", NOT_CHECKED: "neutral" } as const;

/**
 * The challenge editor, for a new challenge (Create Challenge) or an existing
 * one (/challenges/[id]). Opening an existing challenge is how an admin runs
 * its checks: Validate Problem sends it to the isolated runner server-side.
 */
export function ChallengeEditorScreen({ challengeId }: { challengeId?: string }) {
  const { loading, isAdmin } = useRequireAdmin();
  const router = useRouter();
  const editor = useChallengeEditor();
  const { loadChallenge } = editor;
  const isEdit = !!challengeId;

  const [mode, setMode] = useState<CreationMode>("MANUAL");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!isEdit);
  const [pool, setPool] = useState<BattlePool | null>(null);

  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiStatusKnown, setAiStatusKnown] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !challengeId) return;
    let cancelled = false;
    challengeService.get(challengeId).then(
      (response) => {
        if (cancelled) return;
        loadChallenge(response.challenge);
        setLoaded(true);
      },
      (caught: unknown) => {
        if (!cancelled) {
          setLoadError(caught instanceof ApiError ? caught.message : "Could not load this challenge.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isAdmin, challengeId, loadChallenge]);

  // Eligibility follows the saved state, so re-read it after every save,
  // validation run or publish.
  const savedId = editor.challengeId;
  useEffect(() => {
    if (!isAdmin || !savedId) return;
    let cancelled = false;
    challengeService.battlePool().then(
      (response) => {
        if (!cancelled) setPool(response.pool);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [isAdmin, savedId, editor.status, editor.rawValidationStatus, editor.validatedAt, editor.savedAt]);

  // Whether the AI button works at all is a server fact, not a guess.
  useEffect(() => {
    if (!isAdmin || isEdit) return;
    let cancelled = false;
    challengeService
      .aiStatus()
      .then((status) => {
        if (cancelled) return;
        setAiConfigured(status.configured);
        setAiMessage(status.message);
      })
      .catch(() => {
        if (!cancelled) setAiMessage("AI generation status is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setAiStatusKnown(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, isEdit]);

  // Warn before losing unsaved work.
  useEffect(() => {
    if (!editor.dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editor.dirty]);

  const handleGenerate = useCallback(
    async (payload: AiGenerateRequest) => {
      setAiGenerating(true);
      setAiError(null);
      try {
        const response = await challengeService.generateWithAI(payload);
        // Prefill only. Nothing is persisted until the admin saves it.
        editor.replaceDraft(draftFromPayload(response.draft));
        setMode("MANUAL");
        editor.setToast({ tone: "green", message: "Draft generated. Review it before saving." });
      } catch (caught) {
        setAiError(caught instanceof ApiError ? caught.message : "AI generation failed. Please try again.");
      } finally {
        setAiGenerating(false);
      }
    },
    [editor],
  );

  const handleImport = useCallback(
    async (content: string, fileName: string, mimeType: string) => {
      setImporting(true);
      setImportError(null);
      try {
        // The server parses and validates the file; it comes back as a DRAFT.
        const response = await challengeService.import(content, fileName, mimeType);
        editor.adoptChallenge(response.challenge);
        setMode("MANUAL");
      } catch (caught) {
        setImportError(caught instanceof ApiError ? caught.message : "That file could not be imported.");
      } finally {
        setImporting(false);
      }
    },
    [editor],
  );

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const { template } = await challengeService.downloadTemplate();
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "codeclash-challenge-template.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setImportError("The template could not be downloaded.");
    }
  }, []);

  const openConfirm = (action: "archive" | "delete") => {
    setConfirmError(null);
    setConfirming(action);
  };

  const runConfirmed = async () => {
    const action = confirming;
    if (!action) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      if (action === "archive") {
        await editor.archive();
        setConfirming(null);
        setConfirmBusy(false);
      } else {
        await editor.remove();
        // Stays busy until the list replaces this page.
        router.replace("/challenges");
      }
    } catch (caught) {
      setConfirmError(
        caught instanceof ApiError
          ? caught.message
          : `The challenge could not be ${action === "archive" ? "archived" : "deleted"}.`,
      );
      setConfirmBusy(false);
    }
  };

  if (loading || !isAdmin || (isEdit && !loaded && !loadError)) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="flex items-center gap-2 text-[13px] text-dim">
          <IconSpinner size={16} />
          {loading || !isAdmin ? "Loading admin console…" : "Loading challenge…"}
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <AdminShell breadcrumbs={[{ label: "Challenges", href: "/challenges" }, { label: "Not found" }]}>
        <div className="mx-auto w-full max-w-xl px-4 py-10">
          <Notice tone="rose">{loadError}</Notice>
          <Link href="/challenges" className="mt-4 inline-block">
            <Button>Back to challenges</Button>
          </Link>
        </div>
      </AdminShell>
    );
  }

  const issues = draftIssues(editor.draft);
  const locked = editor.status === "PUBLISHED";
  const title = isEdit ? editor.draft.title || "Untitled challenge" : "Create Challenge";
  const poolEntry = pool?.challenges.find((c) => c.id === editor.challengeId) ?? null;
  // Archiving the challenge that keeps the pool above the per-match minimum
  // stops every new match from starting.
  const archiveEmptiesPool =
    !!pool && !!poolEntry?.eligible && pool.eligibleCount - 1 < pool.challengeCount;

  return (
    <AdminShell
      breadcrumbs={[{ label: "Challenges", href: "/challenges" }, { label: isEdit ? title : "Create" }]}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-blue/25 bg-gradient-to-br from-blue/25 to-violet/10 text-blue-soft">
              <IconTrophy size={20} />
            </span>
            <div>
              <h1 className="text-[26px] leading-tight font-bold tracking-tight">{title}</h1>
              <p className="mt-0.5 text-[13px] text-muted">
                {isEdit
                  ? "Review the challenge, run its checks, and publish it."
                  : "Build, validate, and publish coding problems for CodeClash."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">FUNCTION · JavaScript</Badge>
            {editor.challengeId ? (
              <>
                <Badge tone="blue" className="mono">
                  {editor.draft.slug}
                </Badge>
                <Badge tone={VALIDATION_TONE[editor.rawValidationStatus]}>
                  {editor.rawValidationStatus.replace("_", " ")}
                </Badge>
              </>
            ) : null}
          </div>
        </div>

        {editor.toast ? (
          <div className="mt-4">
            <Notice tone={editor.toast.tone}>{editor.toast.message}</Notice>
          </div>
        ) : null}

        {editor.error ? (
          <div className="mt-3">
            <Notice tone="rose">{editor.error}</Notice>
          </div>
        ) : null}

        {locked ? (
          <div className="mt-3">
            <Notice tone="amber">
              This challenge is published. Its title, description, difficulty and tags can still be edited and
              saved. Its slug, tests, contract, judging and limits are frozen so live and historical matches cannot
              change underneath them; to change those, archive it, edit and re-validate it, then publish it again.
              You can still run its checks.
            </Notice>
          </div>
        ) : null}

        {!isEdit ? (
          <div className="mt-5">
            <CreationModeSelector
              mode={mode}
              onChange={setMode}
              aiConfigured={aiConfigured}
              aiStatusKnown={aiStatusKnown}
            />
          </div>
        ) : null}

        {!isEdit && mode === "AI" ? (
          <div className="mt-4">
            <AiGeneratePanel
              configured={aiConfigured}
              statusMessage={aiMessage}
              generating={aiGenerating}
              error={aiError}
              onGenerate={handleGenerate}
            />
          </div>
        ) : null}

        {!isEdit && mode === "JSON_IMPORT" ? (
          <div className="mt-4">
            <JsonImportPanel
              importing={importing}
              error={importError}
              onImport={handleImport}
              onDownloadTemplate={handleDownloadTemplate}
            />
          </div>
        ) : null}

        <div className={cx("mt-4 grid gap-4", "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]")}>
          <div className="space-y-4">
            <BasicInformationSection draft={editor.draft} patch={editor.patch} lockSlug={locked} />
            <JudgeMethodSelector draft={editor.draft} patch={editor.patch} disabled={locked} />
          </div>

          <div className="space-y-4">
            <FunctionContractEditor draft={editor.draft} patch={editor.patch} disabled={locked} />
            <TestCasesEditor draft={editor.draft} patch={editor.patch} disabled={locked} />
          </div>

          <div className="space-y-4">
            <ValidationStatusPanel
              status={editor.rawValidationStatus}
              checks={editor.checks}
              validatedAt={editor.validatedAt}
              running={editor.busy.validating}
              stale={editor.validationStale}
              error={editor.validationError}
              disabled={editor.busy.saving || editor.busy.publishing}
              onValidate={editor.validate}
            />
            {editor.challengeId ? <BattleEligibilityCard entry={poolEntry} pool={pool} /> : null}
            <ExecutionLimitsPanel draft={editor.draft} patch={editor.patch} disabled={locked} />
            {issues.length > 0 ? (
              <Notice tone="amber">
                <p className="font-semibold">Before publishing</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {issues.slice(0, 6).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <AdvancedJudgeEditor draft={editor.draft} patch={editor.patch} disabled={locked} />
        </div>
      </div>

      <ChallengeActionBar
        status={editor.status}
        validationStatus={editor.validationStatus}
        saveState={editor.saveState}
        savedAt={editor.savedAt}
        challengeId={editor.challengeId}
        dirty={editor.dirty}
        busy={editor.busy}
        onSave={editor.save}
        onValidate={editor.validate}
        onPreview={() => setPreviewOpen(true)}
        onPublish={editor.publish}
        onArchive={() => openConfirm("archive")}
        onDelete={() => openConfirm("delete")}
      />

      {previewOpen ? <PreviewDialog draft={editor.draft} onClose={() => setPreviewOpen(false)} /> : null}

      {confirming === "archive" ? (
        <ConfirmDialog
          title="Archive this challenge?"
          description="New matches stop using it. Matches already played keep their results."
          icon={
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-amber/30 bg-amber/12 text-amber-300">
              <IconArchive size={17} />
            </span>
          }
          confirmLabel="Archive challenge"
          confirmIcon={<IconArchive size={15} />}
          busy={confirmBusy}
          error={confirmError}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void runConfirmed()}
        >
          <div className="rounded-[10px] border border-line bg-panel-2/50 px-3 py-2.5">
            <p className="text-[12.5px] font-semibold text-fg">{editor.draft.title || "Untitled challenge"}</p>
            <p className="mono text-[11.5px] text-dim">/{editor.draft.slug}</p>
          </div>
          {archiveEmptiesPool && pool ? (
            <Notice tone="amber">
              Only {pool.eligibleCount} challenges are battle-eligible and every match needs{" "}
              {pool.challengeCount}. Until another one is published and validated, new matches cannot start.
            </Notice>
          ) : null}
          <p className="text-[12px] leading-relaxed text-dim">
            Once archived it can be edited, re-validated and published again.
          </p>
        </ConfirmDialog>
      ) : null}

      {confirming === "delete" ? (
        <ConfirmDialog
          title="Delete this challenge?"
          description="It is removed permanently, with all of its test cases. This cannot be undone."
          icon={
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-rose/30 bg-rose/12 text-rose-300">
              <IconTrash size={17} />
            </span>
          }
          confirmLabel="Delete challenge"
          confirmIcon={<IconTrash size={15} />}
          danger
          busy={confirmBusy}
          error={confirmError}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void runConfirmed()}
        >
          <div className="rounded-[10px] border border-line bg-panel-2/50 px-3 py-2.5">
            <p className="text-[12.5px] font-semibold text-fg">{editor.draft.title || "Untitled challenge"}</p>
            <p className="mono text-[11.5px] text-dim">/{editor.draft.slug}</p>
          </div>
          {editor.status === "ARCHIVED" ? (
            <p className="text-[12px] leading-relaxed text-dim">
              If any match has used this challenge the server keeps it, so match history stays intact; it then
              simply stays archived.
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </AdminShell>
  );
}
