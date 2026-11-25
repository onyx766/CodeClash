"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ExternalLink, Flag, Maximize2, Minimize2, Play, Upload } from "lucide-react";
import { ApiError, matches as matchesApi } from "../../../lib/api";
import { AWAITING_START, useBattle } from "../../../hooks/useBattle";
import useAuth from "../../../hooks/useAuth";
import useProfile from "../../../hooks/useProfile";
import { VERDICT_LABEL, type SubmitResponse, type TestRunResult } from "../../../lib/battle";
import {
  Countdown,
  DescriptionModal,
  DifficultyTag,
  GiveUpDialog,
  MatchLogPanel,
  OpponentProgressPanel,
  PlayerCard,
  ProblemList,
  ResultDialog,
  Spinner,
  TestCasesPanel,
  type Outcome,
} from "../../../components/battle/BattlePanels";
import { ReadyCheck } from "../../../components/battle/ReadyCheck";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const draftKey = (matchId: string, matchChallengeId: string) => `cc:battle:${matchId}:draft:${matchChallengeId}`;
const selectedKey = (matchId: string) => `cc:battle:${matchId}:selected`;

// Storage can throw (private mode, blocked site data) - drafts are a
// convenience, never required.
function readStore(kind: "local" | "session", key: string): string | null {
  try {
    return (kind === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function writeStore(kind: "local" | "session", key: string, value: string) {
  try {
    (kind === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // ignore
  }
}

const STATUS_LABEL: Record<string, string> = {
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
  PENDING_READY: "Waiting",
  READY: "Starting",
};

export default function MatchPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const { match, statements, error, live, clockSkewMs, refresh, readyDeadline, readyCheckEnd } = useBattle(matchId);
  const { refreshActiveRoom } = useAuth();
  const { refetch: refetchProfile } = useProfile();

  // The challenge the player clicked (remembered per tab). Which challenge is
  // open is purely client state - players may work in any order.
  const [pickedId, setPickedId] = useState<string | null>(() => readStore("session", selectedKey(matchId)));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"code" | "tests">("code");
  const [busy, setBusy] = useState<"run" | "submit" | "giveup" | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expired, setExpired] = useState(false);

  // Flips when the server clock passes expiresAt (immediately if it already has).
  useEffect(() => {
    if (!match?.expiresAt) return;
    const remaining = new Date(match.expiresAt).getTime() - (Date.now() + clockSkewMs);
    const id = setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(id);
  }, [match?.expiresAt, clockSkewMs]);

  const inProgress = match?.status === "IN_PROGRESS";
  const finished = match?.status === "FINISHED" || match?.status === "CANCELLED";

  // Once the match is over its room is finished too: stop routing the player
  // back to it, and pick up the new rating and records.
  useEffect(() => {
    if (!finished) return;
    void refreshActiveRoom();
    void refetchProfile();
  }, [finished, refreshActiveRoom, refetchProfile]);

  // The server resolves an expired match within a few seconds; poll until it
  // has. Also poll while the socket is down, so the page never goes stale.
  useEffect(() => {
    if (!inProgress || (!expired && live)) return;
    const id = setInterval(() => void refresh(), expired ? 2000 : 5000);
    return () => clearInterval(id);
  }, [inProgress, expired, live, refresh]);

  // Until the player picks one, open the first unsolved challenge.
  const selected = match
    ? (match.challenges.find((c) => c.matchChallengeId === pickedId) ??
      match.challenges.find((c) => c.myProgress.status !== "SOLVED") ??
      match.challenges[0] ??
      null)
    : null;
  const selectedId = selected?.matchChallengeId ?? null;
  const statement = statements?.find((s) => s.matchChallengeId === selectedId) ?? null;
  // Drafts survive a refresh via localStorage; otherwise the starter code.
  const code = selectedId
    ? (edits[selectedId] ??
      readStore("local", draftKey(matchId, selectedId)) ??
      statement?.challenge.starterCode ??
      "")
    : "";
  const spectator = match?.viewer === "SPECTATOR";
  const canPlay = !!match && inProgress && !expired && !spectator && !match.me?.gaveUp;
  const solvedSelected = selected?.myProgress.status === "SOLVED";

  const select = (matchChallengeId: string) => {
    setPickedId(matchChallengeId);
    writeStore("session", selectedKey(matchId), matchChallengeId);
    setNotice(null);
  };

  const updateCode = (value: string | undefined) => {
    if (!selectedId) return;
    const next = value ?? "";
    setEdits((current) => ({ ...current, [selectedId]: next }));
    writeStore("local", draftKey(matchId, selectedId), next);
  };

  const run = useCallback(async () => {
    if (!selectedId || !canPlay || busy) return;
    setBusy("run");
    setNotice(null);
    setTab("tests");
    try {
      const res = (await matchesApi.run(matchId, selectedId, code)) as { run: TestRunResult };
      setOutcomes((current) => ({ ...current, [selectedId]: { kind: "run", result: res.run } }));
      void refresh();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof ApiError ? e.message : "Run failed." });
    } finally {
      setBusy(null);
    }
  }, [selectedId, canPlay, busy, matchId, code, refresh]);

  const submit = useCallback(async () => {
    if (!selectedId || !canPlay || busy || solvedSelected) return;
    setBusy("submit");
    setNotice(null);
    setTab("tests");
    try {
      const res = (await matchesApi.submit(matchId, selectedId, code)) as SubmitResponse;
      setOutcomes((current) => ({ ...current, [selectedId]: { kind: "submit", response: res } }));
      const status = res.submission?.status ?? "SYSTEM_ERROR";
      setNotice(
        res.solved
          ? { tone: "success", text: `Accepted — ${selected?.challenge.title ?? "challenge"} solved!` }
          : status === "ACCEPTED"
            ? { tone: "error", text: "Accepted, but the match was already over." }
            : { tone: "error", text: VERDICT_LABEL[status] ?? status },
      );
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof ApiError ? e.message : "Submit failed." });
    } finally {
      setBusy(null);
      void refresh();
    }
  }, [selectedId, canPlay, busy, solvedSelected, matchId, code, selected, refresh]);

  // Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter submits. Captured before
  // Monaco sees the keystroke, which would otherwise insert a line.
  const actions = useRef({ run, submit });
  useEffect(() => {
    actions.current = { run, submit };
  }, [run, submit]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      void (e.shiftKey ? actions.current.submit() : actions.current.run());
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const giveUp = async () => {
    setBusy("giveup");
    try {
      await matchesApi.giveUp(matchId);
      await refresh();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof ApiError ? e.message : "Could not give up." });
    } finally {
      setConfirmGiveUp(false);
      setBusy(null);
    }
  };

  if (error && !match) {
    const text =
      error.code === "MATCH_ACCESS_DENIED"
        ? "You are not a player in this match."
        : error.status === 404 || error.status === 400
          ? "This match does not exist."
          : error.message;
    return (
      <div className="cc-container flex min-h-screen items-center justify-center">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-[18px] font-bold">Match unavailable</h1>
          <p className="mt-2 text-[14px] text-muted">{text}</p>
          <Link href="/lobby" className="btn btn-blue mt-5">
            Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-[14px] text-muted">
        <Spinner /> Loading match…
      </div>
    );
  }

  // Quick Match ready check, or a match called off before it began.
  if (AWAITING_START.includes(match.status) || (match.status === "CANCELLED" && !match.startedAt)) {
    return (
      <ReadyCheck
        match={match}
        readyDeadline={readyDeadline}
        skewMs={clockSkewMs}
        readyCheckEnd={readyCheckEnd}
        refresh={refresh}
      />
    );
  }

  const over = finished;

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/lobby" className="flex items-center gap-2">
            <Image src="/assets/logo.png" alt="" width={30} height={30} />
            <span className="text-[19px] font-bold">CodeClash</span>
          </Link>
          <span className="hidden h-6 w-px bg-line sm:block" />
          <span className="hidden text-[14px] text-muted sm:inline">Battle</span>
          <span className="text-[19px] font-bold tracking-wider text-blue-300">{match.code}</span>
          <span
            className={`hidden rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide md:inline ${
              match.ratingEligible
                ? "border-amber/30 bg-amber/10 text-amber-300"
                : "border-violet/30 bg-violet/10 text-violet-300"
            }`}
          >
            {match.ratingEligible ? "Ranked" : "Casual"}
          </span>
        </div>

        <Countdown
          expiresAt={match.expiresAt}
          skewMs={clockSkewMs}
          running={inProgress}
          label={STATUS_LABEL[match.status] ?? match.status}
        />

        <div className="flex items-center gap-2">
          {over && resultDismissed && (
            <button type="button" onClick={() => setResultDismissed(false)} className="btn btn-ghost !py-2.5">
              View result
            </button>
          )}
          {!spectator && (
            <button
              type="button"
              onClick={() => setConfirmGiveUp(true)}
              disabled={!inProgress || !!match.me?.gaveUp || busy !== null}
              className="btn border-rose/45 bg-rose/10 !py-2.5 text-rose-300 hover:bg-rose/20"
            >
              <Flag size={16} /> Give Up
            </button>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <section className="grid shrink-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <PlayerCard player={match.me} side="left" isYou={!spectator} />
          <div className="hidden items-center justify-center px-5 text-[26px] font-light italic text-dim md:flex">VS</div>
          <PlayerCard player={match.opponent} side="right" isYou={false} />
        </section>

        {spectator && (
          <p className="shrink-0 rounded-lg border border-violet/30 bg-violet/10 px-4 py-2 text-[13px] text-violet-200">
            You are spectating this match as an administrator.
          </p>
        )}

        <section className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(250px,300px)_minmax(0,1fr)_minmax(250px,300px)]">
          <ProblemList challenges={match.challenges} selectedId={selectedId} onSelect={select} />

          <div
            className={`card flex min-h-[520px] min-w-0 flex-col overflow-hidden ${
              expanded ? "fixed inset-3 z-40 !min-h-0 shadow-2xl" : "lg:min-h-0"
            }`}
          >
            {selected && statement ? (
              <>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pt-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <h1 className="truncate text-[21px] font-bold">{selected.challenge.title}</h1>
                    <DifficultyTag difficulty={selected.challenge.difficulty} />
                  </div>
                  <button type="button" onClick={() => setShowDescription(true)} className="btn btn-ghost !py-2 !text-[13px]">
                    View Full Description <ExternalLink size={14} />
                  </button>
                </div>
                <p className="line-clamp-2 shrink-0 px-5 pt-2 text-[13px] text-muted">{statement.challenge.description}</p>

                <div className="mx-4 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-black/20">
                  <div className="flex shrink-0 items-center justify-between border-b border-line">
                    <div className="flex">
                      {(["code", "tests"] as const).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setTab(key)}
                          className={`border-b-2 px-6 py-2.5 text-[14px] font-semibold transition-colors ${
                            tab === key ? "border-blue bg-blue/15 text-fg" : "border-transparent text-muted hover:text-fg"
                          }`}
                        >
                          {key === "code" ? "Code" : "Test Cases"}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pr-2">
                      <select
                        aria-label="Language"
                        className="field !w-auto !py-1.5 !text-[12.5px]"
                        value="javascript"
                        onChange={() => undefined}
                      >
                        <option value="javascript">JavaScript (Node.js)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="btn btn-ghost !p-2"
                        aria-label={expanded ? "Exit full screen" : "Full screen"}
                      >
                        {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className={`min-h-[280px] flex-1 ${tab === "code" ? "" : "hidden"}`}>
                    <MonacoEditor
                      height="100%"
                      path={`${matchId}/${selected.matchChallengeId}.js`}
                      defaultLanguage="javascript"
                      theme="vs-dark"
                      value={code}
                      onChange={updateCode}
                      options={{
                        readOnly: !canPlay,
                        minimap: { enabled: false },
                        fontSize: 14,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                      }}
                    />
                  </div>
                  {tab === "tests" && (
                    <div className="min-h-[280px] flex-1 overflow-hidden">
                      <TestCasesPanel statement={statement} outcome={outcomes[selected.matchChallengeId]} />
                    </div>
                  )}
                </div>

                <div className="m-4 mt-3 shrink-0 rounded-xl border border-line bg-black/20 px-4 py-3">
                  {notice && (
                    <p
                      className={`mb-3 rounded-lg border px-3 py-2 text-[13px] ${
                        notice.tone === "success"
                          ? "border-green/30 bg-green/10 text-emerald-200"
                          : "border-rose/30 bg-rose/10 text-rose-200"
                      }`}
                    >
                      {notice.text}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => void run()}
                      disabled={!canPlay || busy !== null}
                      className="btn btn-ghost !px-5 !py-3 !text-[15px]"
                    >
                      {busy === "run" ? <Spinner /> : <Play size={17} className="text-blue-400" />} Run Tests
                      <kbd className="ml-2 hidden rounded border border-line px-1.5 py-0.5 text-[11px] font-normal text-dim sm:inline">
                        Ctrl + Enter
                      </kbd>
                    </button>
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={!canPlay || busy !== null || solvedSelected}
                        className={`btn !px-7 !py-3 !text-[15px] ${solvedSelected ? "btn-outline-green" : "btn-blue"}`}
                      >
                        {busy === "submit" ? <Spinner /> : <Upload size={17} />}
                        {solvedSelected ? "Solved" : "Submit Solution"}
                      </button>
                      <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] text-dim sm:inline">
                        Ctrl + Shift + Enter
                      </kbd>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center gap-2 text-[14px] text-muted">
                <Spinner /> Loading problem…
              </div>
            )}
          </div>

          <aside className="flex min-h-0 flex-col gap-3">
            <OpponentProgressPanel opponent={match.opponent} challenges={match.challenges} />
            <MatchLogPanel match={match} live={live} />
          </aside>
        </section>
      </main>

      {showDescription && statement && (
        <DescriptionModal statement={statement} onClose={() => setShowDescription(false)} />
      )}
      {confirmGiveUp && (
        <GiveUpDialog
          ranked={match.ratingEligible}
          busy={busy === "giveup"}
          onCancel={() => setConfirmGiveUp(false)}
          onConfirm={() => void giveUp()}
        />
      )}
      {over && !resultDismissed && <ResultDialog match={match} onClose={() => setResultDismissed(true)} />}
    </div>
  );
}
