"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import { challengeService } from "../../../services/challenge.service";
import { useRequireAdmin } from "../../../hooks/useAdminAuth";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Badge, Notice, cx } from "../../../components/ui/Primitives";
import { IconSpinner, IconTrophy } from "../../../components/ui/Icons";
import {
  CreationModeSelector,
  type CreationMode,
} from "../../../components/challenges/CreationModeSelector";
import { BasicInformationSection } from "../../../components/challenges/BasicInformationSection";
import { FunctionContractEditor } from "../../../components/challenges/FunctionContractEditor";
import { JudgeMethodSelector } from "../../../components/challenges/JudgeMethodSelector";
import { TestCasesEditor } from "../../../components/challenges/TestCasesEditor";
import { AdvancedJudgeEditor } from "../../../components/challenges/AdvancedJudgeEditor";
import { ExecutionLimitsPanel } from "../../../components/challenges/ExecutionLimitsPanel";
import { ValidationStatusPanel } from "../../../components/challenges/ValidationStatusPanel";
import { ChallengeActionBar } from "../../../components/challenges/ChallengeActionBar";
import { AiGeneratePanel } from "../../../components/challenges/AiGeneratePanel";
import { JsonImportPanel } from "../../../components/challenges/JsonImportPanel";
import { PreviewDialog } from "../../../components/challenges/PreviewDialog";
import { useChallengeEditor } from "../../../components/challenges/useChallengeEditor";
import { draftFromPayload, draftIssues } from "../../../lib/draft";
import type { AiGenerateRequest } from "../../../lib/types";

export default function CreateChallengePage() {
  const { loading, isAdmin } = useRequireAdmin();
  const editor = useChallengeEditor();

  const [mode, setMode] = useState<CreationMode>("MANUAL");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiStatusKnown, setAiStatusKnown] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Whether the AI button works at all is a server fact, not a guess.
  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

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
        editor.setToast({
          tone: "green",
          message: "Draft generated. Review it before saving.",
        });
      } catch (caught) {
        setAiError(
          caught instanceof ApiError
            ? caught.message
            : "AI generation failed. Please try again.",
        );
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
        setImportError(
          caught instanceof ApiError
            ? caught.message
            : "That file could not be imported.",
        );
      } finally {
        setImporting(false);
      }
    },
    [editor],
  );

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const { template } = await challengeService.downloadTemplate();
      const blob = new Blob([JSON.stringify(template, null, 2)], {
        type: "application/json",
      });
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

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="flex items-center gap-2 text-[13px] text-dim">
          <IconSpinner size={16} />
          Loading admin console…
        </span>
      </div>
    );
  }

  const issues = draftIssues(editor.draft);
  const locked = editor.status === "PUBLISHED";

  return (
    <AdminShell
      breadcrumbs={[
        { label: "Challenges", href: "/challenges" },
        { label: "Create" },
      ]}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-4 sm:px-6">
        {/* ---------------- page header ---------------- */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-blue/25 bg-gradient-to-br from-blue/25 to-violet/10 text-blue-soft">
              <IconTrophy size={20} />
            </span>
            <div>
              <h1 className="text-[26px] leading-tight font-bold tracking-tight">
                Create Challenge
              </h1>
              <p className="mt-0.5 text-[13px] text-muted">
                Build, validate, and publish coding problems for CodeClash.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">FUNCTION · JavaScript</Badge>
            {editor.challengeId ? (
              <Badge tone="blue" className="mono">
                {editor.draft.slug}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* ---------------- toast ---------------- */}
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
              This challenge is published. Its tests, contract, judging and
              limits are frozen so live and historical matches cannot change
              underneath them — archive it to author a new version.
            </Notice>
          </div>
        ) : null}

        {/* ---------------- creation mode ---------------- */}
        <div className="mt-5">
          <CreationModeSelector
            mode={mode}
            onChange={setMode}
            aiConfigured={aiConfigured}
            aiStatusKnown={aiStatusKnown}
          />
        </div>

        {mode === "AI" ? (
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

        {mode === "JSON_IMPORT" ? (
          <div className="mt-4">
            <JsonImportPanel
              importing={importing}
              error={importError}
              onImport={handleImport}
              onDownloadTemplate={handleDownloadTemplate}
            />
          </div>
        ) : null}

        {/* ---------------- editor ---------------- */}
        <div
          className={cx(
            "mt-4 grid gap-4",
            "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]",
          )}
        >
          <div className="space-y-4">
            <BasicInformationSection
              draft={editor.draft}
              patch={editor.patch}
              disabled={locked}
            />
            <JudgeMethodSelector
              draft={editor.draft}
              patch={editor.patch}
              disabled={locked}
            />
          </div>

          <div className="space-y-4">
            <FunctionContractEditor
              draft={editor.draft}
              patch={editor.patch}
              disabled={locked}
            />
            <TestCasesEditor
              draft={editor.draft}
              patch={editor.patch}
              disabled={locked}
            />
          </div>

          <div className="space-y-4">
            <ExecutionLimitsPanel
              draft={editor.draft}
              patch={editor.patch}
              disabled={locked}
            />
            <ValidationStatusPanel
              status={editor.rawValidationStatus}
              checks={editor.checks}
              validatedAt={editor.validatedAt}
              running={editor.busy.validating}
              stale={editor.validationStale}
              error={editor.validationError}
              onValidate={editor.validate}
            />
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
          <AdvancedJudgeEditor
            draft={editor.draft}
            patch={editor.patch}
            disabled={locked}
          />
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
      />

      {previewOpen ? (
        <PreviewDialog draft={editor.draft} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </AdminShell>
  );
}
