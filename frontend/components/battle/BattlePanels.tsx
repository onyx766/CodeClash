"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Clock, Crown, Flag, Gem, Trophy, X } from "lucide-react";
import { Avatar, avatarForUserId } from "../ui/Bits";
import Markdown from "../ui/Markdown";
import {
  VERDICT_LABEL,
  formatClock,
  formatOffset,
  type BattleChallenge,
  type BattleMatch,
  type BattlePlayer,
  type ChallengeStatement,
  type ChallengeStatus,
  type Difficulty,
  type MatchLogEntry,
  type SubmitResponse,
  type TestRunResult,
} from "../../lib/battle";

export type Outcome = { kind: "run"; result: TestRunResult } | { kind: "submit"; response: SubmitResponse };

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

const DIFFICULTY_STYLE: Record<Difficulty, { label: string; className: string }> = {
  EASY: { label: "Easy", className: "border-green/30 bg-green/10 text-emerald-300" },
  MEDIUM: { label: "Medium", className: "border-amber/30 bg-amber/10 text-amber-300" },
  HARD: { label: "Hard", className: "border-rose/30 bg-rose/10 text-rose-300" },
  EXPERT: { label: "Expert", className: "border-violet/30 bg-violet/10 text-violet-300" },
};

export function DifficultyTag({ difficulty, className = "" }: { difficulty: Difficulty; className?: string }) {
  const style = DIFFICULTY_STYLE[difficulty];
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-[12px] font-medium ${style.className} ${className}`}>
      {style.label}
    </span>
  );
}

function SolvedMark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[#07120c]"
      style={{ width: size, height: size }}
      aria-label="Solved"
    >
      <Check size={size * 0.62} strokeWidth={3.2} />
    </span>
  );
}

function StatusMark({ status, active, size = 22 }: { status: ChallengeStatus; active?: boolean; size?: number }) {
  if (status === "SOLVED") return <SolvedMark size={size} />;
  if (active) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-blue text-white"
        style={{ width: size, height: size }}
        aria-label="Selected"
      >
        <ChevronRight size={size * 0.62} strokeWidth={3} />
      </span>
    );
  }
  if (status === "ATTEMPTING") {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-amber/70"
        style={{ width: size, height: size }}
        aria-label="Attempting"
      >
        <span className="h-2 w-2 rounded-full bg-amber" />
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full border-2 border-muted/60"
      style={{ width: size, height: size }}
      aria-label="Not started"
    />
  );
}

function progressLabel(progress: BattleChallenge["myProgress"]): string {
  if (progress.status === "SOLVED") {
    return `Solved • ${formatOffset(progress.solveDurationMs ?? 0)}`;
  }
  if (progress.status === "ATTEMPTING") {
    return progress.attempts > 0
      ? `Attempting • ${progress.attempts} ${progress.attempts === 1 ? "attempt" : "attempts"}`
      : "Attempting";
  }
  return "Not solved";
}

export function Countdown({
  expiresAt,
  skewMs,
  running,
  label,
}: {
  expiresAt: string | null;
  skewMs: number;
  running: boolean;
  label: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  // Display only: the server clock decides when the match ends.
  const remaining = expiresAt ? new Date(expiresAt).getTime() - (now + skewMs) : 0;
  const low = running && remaining < 60_000;
  return (
    <div className="card flex min-w-[170px] flex-col items-center px-6 py-1.5 sm:px-10">
      <p
        className={`flex items-center gap-2 text-[24px] font-bold leading-tight tabular-nums sm:text-[26px] ${
          low ? "text-rose-400" : "text-fg"
        }`}
      >
        <Clock size={20} strokeWidth={2.2} />
        {running ? formatClock(remaining) : "--:--"}
      </p>
      <p className="eyebrow !text-[10px]">{running ? (remaining > 0 ? "Remaining" : "Time's up") : label}</p>
    </div>
  );
}

export function PlayerCard({
  player,
  side,
  isYou,
}: {
  player: BattlePlayer | null;
  side: "left" | "right";
  isYou: boolean;
}) {
  if (!player) return <div className="card" />;
  const left = side === "left";
  return (
    <div
      className={`card flex items-center gap-4 px-4 py-3 sm:px-5 ${left ? "" : "flex-row-reverse text-right"} ${
        left ? "!border-blue/25" : "!border-rose/20"
      }`}
    >
      <Avatar src={avatarForUserId(player.id)} alt={player.username} size={60} ring />
      <div className={`flex min-w-0 flex-1 flex-col ${left ? "items-start" : "items-end"}`}>
        <p className="flex max-w-full items-center gap-2 text-[17px] font-bold">
          <span className="truncate">{player.displayName || player.username}</span>
          {isYou && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-blue/40 bg-blue/15 px-2 py-0.5 text-[11px] font-bold text-blue-300">
              <Crown size={11} /> YOU
            </span>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-violet-300">
          <Gem size={13} /> {player.rating}
        </p>
        {player.gaveUp && (
          <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-rose-300">
            <Flag size={12} /> Gave up
          </p>
        )}
      </div>
      <div className="shrink-0 text-center">
        <p
          className={`text-[30px] font-extrabold leading-none tabular-nums sm:text-[36px] ${
            left ? "text-blue-400" : "text-rose-400"
          }`}
        >
          {player.solved} <span className="text-fg/90">/ {player.total}</span>
        </p>
        <p className="eyebrow mt-1.5 !text-[10px]">Solved</p>
      </div>
    </div>
  );
}

export function ProblemList({
  challenges,
  selectedId,
  onSelect,
}: {
  challenges: BattleChallenge[];
  selectedId: string | null;
  onSelect: (matchChallengeId: string) => void;
}) {
  return (
    <div className="card flex min-h-0 flex-col overflow-hidden">
      <h2 className="shrink-0 border-b border-line px-4 py-3 text-[15px] font-bold">Problems ({challenges.length})</h2>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {challenges.map((c) => {
          const active = c.matchChallengeId === selectedId;
          return (
            <li key={c.matchChallengeId}>
              <button
                type="button"
                onClick={() => onSelect(c.matchChallengeId)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                  active ? "border-blue/60 bg-blue/10" : "border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <span className="pt-0.5">
                  <StatusMark status={c.myProgress.status} active={active && c.myProgress.status !== "SOLVED"} />
                </span>
                <span className="w-5 shrink-0 pt-0.5 text-center text-[14px] text-muted">{c.position}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-snug">{c.challenge.title}</span>
                  <DifficultyTag difficulty={c.challenge.difficulty} className="mt-1.5" />
                  <span
                    className={`mt-1.5 block text-[12.5px] ${
                      c.myProgress.status === "SOLVED" ? "text-emerald-300/90" : "text-dim"
                    }`}
                  >
                    {progressLabel(c.myProgress)}
                  </span>
                </span>
                {active && <ChevronRight size={16} className="mt-1 shrink-0 text-blue-300" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OpponentProgressPanel({
  opponent,
  challenges,
}: {
  opponent: BattlePlayer | null;
  challenges: BattleChallenge[];
}) {
  return (
    <div className="card shrink-0 p-3">
      <h2 className="px-1 text-[15px] font-bold">Opponent Progress</h2>
      {opponent && (
        <div className="mt-3 flex items-center gap-3 border-b border-line px-1 pb-3">
          <Avatar src={avatarForUserId(opponent.id)} alt={opponent.username} size={40} />
          <span className="min-w-0 truncate text-[14px] font-semibold">{opponent.displayName || opponent.username}</span>
          {opponent.gaveUp && <span className="ml-auto text-[11px] font-semibold text-rose-300">Gave up</span>}
        </div>
      )}
      <ul className="divide-y divide-line">
        {challenges.map((c) => (
          <li key={c.matchChallengeId} className="flex items-center justify-between gap-3 px-1 py-2.5 text-[13.5px]">
            <span className="min-w-0">{c.challenge.title}</span>
            <StatusMark status={c.opponentProgress.status} size={20} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function logText(entry: MatchLogEntry, match: BattleMatch): { text: string; tone: string } {
  const isMe = (id?: string | null) => !!id && id === match.me?.id;
  const name = (id?: string | null) =>
    id === match.me?.id ? match.me?.username : id === match.opponent?.id ? match.opponent?.username : "A player";
  const spectator = match.viewer === "SPECTATOR";
  switch (entry.type) {
    case "MATCH_STARTED":
      return { text: "Match started", tone: "text-blue-300" };
    case "CHALLENGE_SOLVED":
      return isMe(entry.userId) && !spectator
        ? { text: `You solved ${entry.challengeTitle}`, tone: "text-emerald-300" }
        : { text: `${name(entry.userId)} solved ${entry.challengeTitle}`, tone: "text-blue-200/90" };
    case "PLAYER_GAVE_UP":
      return isMe(entry.userId) && !spectator
        ? { text: "You gave up", tone: "text-rose-300" }
        : { text: `${name(entry.userId)} gave up`, tone: "text-rose-300" };
    case "MATCH_FINISHED":
      if (entry.resultType === "DRAW") return { text: "Match ended in a draw", tone: "text-amber-300" };
      return isMe(entry.winnerId) && !spectator
        ? { text: "You won the match", tone: "text-emerald-300" }
        : { text: `${name(entry.winnerId)} won the match`, tone: "text-amber-300" };
    case "MATCH_CANCELLED":
      return { text: "Match cancelled", tone: "text-muted" };
  }
}

export function MatchLogPanel({ match, live }: { match: BattleMatch; live: boolean }) {
  const running = match.status === "IN_PROGRESS";
  return (
    <div className="card flex min-h-[180px] flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-bold">Match Log</h2>
        {running &&
          (live ? (
            <span className="flex items-center gap-2 rounded-md border border-green/25 bg-green/10 px-2 py-0.5 text-[12px] font-semibold text-emerald-300">
              <span className="dot-live" /> Live
            </span>
          ) : (
            <span className="rounded-md border border-amber/25 bg-amber/10 px-2 py-0.5 text-[12px] font-semibold text-amber-300">
              Reconnecting…
            </span>
          ))}
      </div>
      <ol className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {match.log.map((entry, index) => {
          const { text, tone } = logText(entry, match);
          return (
            <li key={`${entry.type}-${entry.at}-${index}`} className="flex gap-4 text-[13px]">
              <span className="w-11 shrink-0 tabular-nums text-muted">{formatOffset(entry.offsetMs)}</span>
              <span className={tone}>{text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatArgs(statement: ChallengeStatement, input: Record<string, unknown>) {
  return statement.challenge.parameters.map((p) => `${p.name} = ${JSON.stringify(input[p.name])}`).join(", ");
}

export function TestCasesPanel({ statement, outcome }: { statement: ChallengeStatement; outcome?: Outcome }) {
  const result = outcome?.kind === "run" ? outcome.result : outcome?.response.results;
  const verdict = outcome?.kind === "submit" ? outcome.response.submission?.status : undefined;
  const hidden = result?.results.filter((r) => r.hidden) ?? [];

  return (
    <div className="h-full overflow-y-auto p-4">
      {result ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-[13.5px] ${
            (verdict ?? (result.passedTests === result.totalTests ? "ACCEPTED" : "FAIL")) === "ACCEPTED"
              ? "border-green/30 bg-green/10 text-emerald-200"
              : "border-rose/30 bg-rose/10 text-rose-200"
          }`}
        >
          <p className="font-semibold">
            {outcome?.kind === "submit"
              ? `${VERDICT_LABEL[verdict ?? "SYSTEM_ERROR"] ?? verdict} — ${result.passedTests}/${result.totalTests} tests passed`
              : `Sample tests: ${result.passedTests}/${result.totalTests} passed`}
          </p>
          <p className="mt-0.5 text-[12px] opacity-80">{Math.round(result.runtimeMs)} ms total runtime</p>
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-dim">
          Run Tests checks your code against the sample tests below. Submit Solution also runs the hidden tests.
        </p>
      )}

      <ul className="space-y-3">
        {statement.challenge.sampleTestCases.map((sample, index) => {
          const run = result?.results.find((r) => !r.hidden && r.order === sample.order);
          return (
            <li key={sample.order} className="card-soft p-3 font-mono text-[12.5px]">
              <div className="mb-2 flex items-center justify-between font-sans">
                <span className="text-[12px] font-semibold text-muted">Sample {index + 1}</span>
                {run && (
                  <span className={`text-[12px] font-semibold ${run.passed ? "text-emerald-300" : "text-rose-300"}`}>
                    {VERDICT_LABEL[run.status] ?? run.status}
                    {` · ${Math.round(run.runtimeMs)} ms`}
                  </span>
                )}
              </div>
              <p className="break-all text-fg/90">
                <span className="text-dim">Input: </span>
                {formatArgs(statement, sample.input)}
              </p>
              <p className="mt-1 break-all text-fg/90">
                <span className="text-dim">Expected: </span>
                {JSON.stringify(sample.expectedOutput)}
              </p>
              {run && !run.passed && typeof run.actualOutput === "string" && (
                <p className="mt-1 break-all text-rose-200">
                  <span className="text-dim">Your output: </span>
                  {run.actualOutput}
                </p>
              )}
              {run?.message && <p className="mt-2 break-all text-rose-300">{run.message}</p>}
            </li>
          );
        })}
      </ul>

      {hidden.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-semibold text-muted">Hidden tests</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((test, index) => (
              <span
                key={index}
                title={VERDICT_LABEL[test.status] ?? test.status}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] ${
                  test.passed
                    ? "border-green/25 bg-green/10 text-emerald-300"
                    : "border-rose/25 bg-rose/10 text-rose-300"
                }`}
              >
                {test.passed ? <Check size={12} /> : <X size={12} />} #{index + 1}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose, label }: { children: React.ReactNode; onClose?: () => void; label: string }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onClick={onClose}
    >
      <div className="card max-h-[88vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function DescriptionModal({ statement, onClose }: { statement: ChallengeStatement; onClose: () => void }) {
  const c = statement.challenge;
  return (
    <Modal onClose={onClose} label={c.title}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold">{c.title}</h2>
          <DifficultyTag difficulty={c.difficulty} className="mt-2" />
        </div>
        <button type="button" onClick={onClose} className="btn btn-ghost !p-2" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <Markdown className="mt-4 text-[14px] leading-relaxed text-fg/90">{c.description}</Markdown>
      <div className="mt-5">
        <p className="eyebrow">Function</p>
        <code className="mt-1.5 block rounded-lg bg-black/30 px-3 py-2 font-mono text-[13px]">
          {c.functionName}({c.parameters.map((p) => `${p.name}: ${p.type}`).join(", ")}) → {c.returnType}
        </code>
      </div>
      <p className="mt-3 text-[12px] text-dim">
        Limits per test: {c.limits.timeLimitMs} ms · {c.limits.memoryLimitMb} MB · {c.limits.outputLimitKb} KB output
      </p>
      <div className="mt-5 space-y-2">
        <p className="eyebrow">Examples</p>
        {c.sampleTestCases.map((sample) => (
          <pre key={sample.order} className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[12.5px]">
            {`Input:    ${formatArgs(statement, sample.input)}\nExpected: ${JSON.stringify(sample.expectedOutput)}`}
          </pre>
        ))}
      </div>
    </Modal>
  );
}

export function GiveUpDialog({
  ranked,
  busy,
  onCancel,
  onConfirm,
}: {
  ranked: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={busy ? undefined : onCancel} label="Give up">
      <h2 className="flex items-center gap-2 text-[18px] font-bold">
        <Flag size={18} className="text-rose-300" /> Give up this match?
      </h2>
      <p className="mt-3 text-[14px] text-muted">
        Your opponent wins immediately.{" "}
        {ranked ? "This counts as a ranked loss." : "This is a casual match, so ratings are not affected."}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost">
          Keep playing
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="btn border-rose/50 bg-rose/15 text-rose-200 hover:bg-rose/25"
        >
          {busy ? <Spinner /> : <Flag size={15} />} Give Up
        </button>
      </div>
    </Modal>
  );
}

function describeResult(match: BattleMatch) {
  const me = match.me;
  const opponent = match.opponent;
  const spectator = match.viewer === "SPECTATOR";
  const winner = match.winnerId === me?.id ? me : match.winnerId === opponent?.id ? opponent : null;
  const total = me?.total ?? opponent?.total ?? 5;

  if (match.status === "CANCELLED") {
    return { title: "Match cancelled", tone: "text-muted", detail: "This match was cancelled. No result was recorded." };
  }
  if (match.resultType === "DRAW") {
    const detail =
      (me?.solved ?? 0) === 0
        ? "Time ran out with nothing solved on either side."
        : `Time ran out at ${me?.solved} vs ${opponent?.solved} solved, with identical total solve time.`;
    return { title: "Draw", tone: "text-amber-300", detail };
  }

  const won = !spectator && winner?.id === me?.id;
  const title = spectator ? `${winner?.username ?? "A player"} won` : won ? "Victory!" : "Defeat";
  let detail = "";
  switch (match.finishReason) {
    case "ALL_CHALLENGES_SOLVED":
      detail = `${won ? "You" : winner?.username} solved all ${total} challenges first.`;
      break;
    case "PLAYER_GAVE_UP":
      detail = won ? `${opponent?.username} gave up.` : spectator ? "The other player gave up." : "You gave up.";
      break;
    case "TIME_EXPIRED":
      detail =
        me && opponent && me.solved === opponent.solved
          ? `Time ran out at ${me.solved} vs ${opponent.solved} solved — decided on total solve time.`
          : `Time ran out at ${me?.solved ?? 0} vs ${opponent?.solved ?? 0} solved.`;
      break;
    default:
      detail = "The match is over.";
  }
  return { title, tone: won || spectator ? "text-emerald-300" : "text-rose-300", detail };
}

export function ResultDialog({ match, onClose }: { match: BattleMatch; onClose: () => void }) {
  const { title, tone, detail } = describeResult(match);
  const me = match.me;
  const ratingLine =
    match.status === "CANCELLED"
      ? "Ratings are unchanged."
      : !match.ratingEligible
        ? "Casual match — ratings are unchanged."
        : me?.ratingAfter != null
          ? `Rating ${me.rating} → ${me.ratingAfter} (${me.ratingAfter - me.rating >= 0 ? "+" : ""}${me.ratingAfter - me.rating})`
          : "Ranked match — your rating is being updated.";

  return (
    <Modal onClose={onClose} label="Match result">
      <div className="text-center">
        <Trophy size={40} className={`mx-auto ${tone}`} />
        <h2 className={`mt-3 text-[26px] font-extrabold ${tone}`}>{title}</h2>
        <p className="mt-2 text-[14px] text-fg/90">{detail}</p>
        {me && match.opponent && (
          <p className="mt-4 text-[15px] font-semibold tabular-nums">
            {me.username} {me.solved}/{me.total} · {match.opponent.username} {match.opponent.solved}/{match.opponent.total}
          </p>
        )}
        <p className="mt-2 text-[13px] text-muted">{ratingLine}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Review match
          </button>
          <a href="/lobby" className="btn btn-blue">
            Back to Lobby
          </a>
        </div>
      </div>
    </Modal>
  );
}
