"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Clock, Loader2, Play, Send, Trophy, User, Users } from "lucide-react";
import { getSocket } from "../../../lib/socket";
import { ApiError, matches as matchesApi, rounds as roundsApi, auth } from "../../../lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type RunResult = {
  passedTests?: number;
  totalTests?: number;
  runtimeMs?: number;
  score?: number;
  error?: string;
  results?: unknown;
};

type MatchState = Awaited<ReturnType<typeof matchesApi.state>>;

function formatClock(ms: number) {
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function MatchPage() {
  const params = useParams();
  const matchId = params.matchId as string;

  const [me, setMe] = useState<{ id: string } | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<string | null>(null);

  // The editor is only seeded from starterCode when the round actually
  // changes - reseeding on every state refetch would wipe out whatever the
  // player is in the middle of typing.
  const seededRoundRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await matchesApi.state(matchId);
      setState(s);
      setError("");
      return s;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load this match.");
      return null;
    }
  }, [matchId]);

  useEffect(() => {
    auth.me().then((u: any) => setMe(u?.user ?? u)).catch(() => setMe(null));
    refresh();
  }, [refresh]);

  // Seed the editor when the round changes.
  useEffect(() => {
    const round = state?.currentRound;
    if (!round || seededRoundRef.current === round.id) return;
    seededRoundRef.current = round.id;
    setCode(round.challenge.starterCode || "");
    setResult(null);
  }, [state?.currentRound?.id, state]);

  // Live updates. Every one of these ends in a refetch so the server stays the
  // single source of truth for scores and round state - the events only say
  // "something changed", they are never trusted to carry the result.
  useEffect(() => {
    const s = getSocket();

    const onRoundStart = () => {
      setFlash("Next round starting");
      refresh();
    };
    const onRoundEnd = (payload: any) => {
      if (payload?.matchId && payload.matchId !== matchId) return;
      setFlash(`Round ${payload?.roundNumber ?? ""} finished`);
      refresh();
    };
    const onMatchEnd = (payload: any) => {
      if (payload?.matchId && payload.matchId !== matchId) return;
      setFlash(null);
      refresh();
    };
    const onOpponentSubmitted = (payload: any) => {
      if (payload?.matchId && payload.matchId !== matchId) return;
      setFlash("Your opponent has submitted");
      refresh();
    };

    s.on("round:start", onRoundStart);
    s.on("round:end", onRoundEnd);
    s.on("match:end", onMatchEnd);
    s.on("round:opponent-submitted", onOpponentSubmitted);
    return () => {
      s.off("round:start", onRoundStart);
      s.off("round:end", onRoundEnd);
      s.off("match:end", onMatchEnd);
      s.off("round:opponent-submitted", onOpponentSubmitted);
    };
  }, [matchId, refresh]);

  // Local ticker for the countdown. The deadline itself is server-set
  // (round.endsAt) and the server closes the round on its own clock - this is
  // display only, so a client with a skewed clock can't gain time.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const round = state?.currentRound ?? null;
  const finished = state?.status === "FINISHED" || state?.status === "CANCELLED";
  const remainingMs = useMemo(() => {
    if (!round?.endsAt) return 0;
    return new Date(round.endsAt).getTime() - now;
  }, [round?.endsAt, now]);

  const locked =
    !round ||
    finished ||
    !!round.finishedAt ||
    round.hasSubmitted ||
    remainingMs <= 0;

  // When the deadline passes the server closes the round within a couple of
  // seconds; poll so the result appears without needing a manual reload.
  useEffect(() => {
    if (!round || finished || round.finishedAt) return;
    if (remainingMs > 0) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [round, finished, remainingMs, refresh]);

  const run = async () => {
    if (!round) return;
    setBusy("run");
    setError("");
    try {
      setResult(await roundsApi.run(round.id, code));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Run failed.");
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!round) return;
    setBusy("submit");
    setError("");
    try {
      const res = await roundsApi.submit(round.id, code);
      setResult(res.submission);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Submit failed.");
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (error && !state) {
    return (
      <div className="cc-container py-10">
        <div className="cc-card p-6">
          <h2 className="text-lg font-semibold">Match unavailable</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link href="/lobby" className="btn btn-blue mt-4 inline-block">
            Back to lobby
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="cc-container flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading match…
      </div>
    );
  }

  const myId = me?.id;
  const opponent = state.players.find((p: any) => p.userId !== myId);
  const mine = state.players.find((p: any) => p.userId === myId);
  const winsFor = (userId?: string) =>
    state.roundWins.find((w: any) => w.userId === userId)?.wins ?? 0;

  return (
    <div className="cc-container space-y-5 py-6">
      {/* Scoreboard */}
      <div className="cc-card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-sm font-semibold">{mine?.username ?? "You"}</p>
            <p className="text-xs text-slate-500">{winsFor(myId)} rounds won</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {state.type === "QUICK_MATCH" ? "Ranked" : "Casual"} · Round{" "}
            {state.currentRoundNumber} of {state.totalRounds}
          </p>
          {round && !finished && !round.finishedAt && (
            <p className="mt-1 flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
              <Clock className="h-4 w-4" /> {formatClock(remainingMs)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold">{opponent?.username ?? "Opponent"}</p>
            <p className="text-xs text-slate-500">{winsFor(opponent?.userId)} rounds won</p>
          </div>
          <Users className="h-4 w-4 text-violet-600" />
        </div>
      </div>

      {flash && !finished && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          {flash}
        </div>
      )}

      {finished && (
        <div className="cc-card p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">
              {state.status === "CANCELLED"
                ? "Match cancelled"
                : state.winnerId === myId
                  ? "You won"
                  : "You lost"}
            </h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {state.status === "CANCELLED"
              ? "No result was recorded, so nobody's rating changed."
              : state.ratingEligible
                ? "Ranked result — ratings and the leaderboard have been updated."
                : "Casual result — ratings are unaffected."}
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/lobby" className="btn btn-blue">
              Back to lobby
            </Link>
            <Link href="/leaderboard" className="btn btn-ghost">
              Leaderboard
            </Link>
          </div>
        </div>
      )}

      {/* Round history */}
      <div className="cc-card divide-y p-0">
        {state.rounds.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="font-medium">
              Round {r.roundNumber}
              {r.challengeTitle ? ` · ${r.challengeTitle}` : ""}
            </span>
            <span className="text-slate-500">
              {!r.finishedAt
                ? r.startedAt
                  ? "in progress"
                  : "not started"
                : r.winnerId === myId
                  ? "you won"
                  : r.winnerId
                    ? "opponent won"
                    : "draw"}
            </span>
          </div>
        ))}
      </div>

      {/* Challenge + editor */}
      {round && !finished ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="cc-card space-y-3 p-4">
            <h3 className="text-base font-semibold">{round.challenge.title}</h3>
            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {round.challenge.difficulty}
            </span>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {round.challenge.description}
            </p>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Function
              </p>
              <code className="rounded bg-slate-100 px-2 py-1 text-xs">
                {round.challenge.functionName}(
                {(round.challenge.parameters ?? [])
                  .map((p: { name: string }) => p.name)
                  .join(", ")}
                )
              </code>
            </div>
            {round.challenge.sampleTestCases.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sample tests
                </p>
                <div className="space-y-2">
                  {round.challenge.sampleTestCases.map((t: any, i: number) => (
                    <pre
                      key={i}
                      className="overflow-x-auto rounded bg-slate-50 p-2 text-xs"
                    >
                      {/* input/expectedOutput are structured JSON, not strings:
                          input is an object keyed by parameter name. */}
                      {`in:  ${JSON.stringify(t.input)}\nout: ${JSON.stringify(t.expectedOutput)}`}
                    </pre>
                  ))}
                </div>
              </div>
            )}
            {round.opponentSubmitted && !round.hasSubmitted && (
              <p className="text-xs font-medium text-amber-600">
                Your opponent has already submitted.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="cc-card overflow-hidden" style={{ height: 420 }}>
              <MonacoEditor
                height="100%"
                defaultLanguage="javascript"
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v || "")}
                options={{ readOnly: locked, minimap: { enabled: false }, fontSize: 13 }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={run} className="btn btn-ghost" disabled={locked || busy !== null}>
                {busy === "run" ? (
                  <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-1 inline h-4 w-4" />
                )}
                Run sample tests
              </button>
              <button onClick={submit} className="btn btn-grad" disabled={locked || busy !== null}>
                {busy === "submit" ? (
                  <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 inline h-4 w-4" />
                )}
                Submit
              </button>
              {round.hasSubmitted && (
                <span className="text-sm text-slate-500">
                  Submitted — waiting for the round to close.
                </span>
              )}
              {!round.hasSubmitted && remainingMs <= 0 && (
                <span className="text-sm text-slate-500">Time is up.</span>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {result && (
              <div className="cc-card p-4 text-sm">
                <p className="font-semibold">
                  {result.passedTests ?? 0} / {result.totalTests ?? 0} tests passed
                  {typeof result.score === "number" ? ` · score ${result.score}` : ""}
                </p>
                {result.error && (
                  <pre className="mt-2 overflow-x-auto rounded bg-red-50 p-2 text-xs text-red-700">
                    {result.error}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      ) : !finished ? (
        <div className="cc-card flex items-center gap-2 p-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Waiting for the next round…
        </div>
      ) : null}
    </div>
  );
}
