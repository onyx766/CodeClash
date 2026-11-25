"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Gem, Swords, X, Zap } from "lucide-react";
import { ApiError, matches as matchesApi } from "../../lib/api";
import type { BattleMatch, BattlePlayer } from "../../lib/battle";
import type { ReadyCheckEnd } from "../../hooks/useBattle";
import useNow, { formatElapsed } from "../../hooks/useNow";
import useQuickMatch from "../../hooks/useQuickMatch";
import { Avatar, avatarForUserId } from "../ui/Bits";
import { Spinner } from "./BattlePanels";

function Contender({
  player,
  label,
  accepted = false,
}: {
  player: BattlePlayer | null;
  label: string;
  accepted?: boolean;
}) {
  if (!player) return <div className="flex-1" />;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <Avatar src={player.avatarUrl || avatarForUserId(player.id)} alt={player.username} size={72} ring />
      <p className="mt-1 max-w-full truncate text-[16px] font-bold">{player.displayName || player.username}</p>
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-violet-300">
        <Gem size={12} /> {player.rating}
      </p>
      <p className="eyebrow !text-[10px]">{label}</p>
      {accepted && (
        <p className="flex items-center gap-1 text-[12px] font-semibold text-emerald-300">
          <Check size={13} /> Accepted
        </p>
      )}
    </div>
  );
}

/** Accept panel while the countdown runs; the reason once it was cancelled. */
function WaitingToStart({
  match,
  readyDeadline,
  skewMs,
  accepted,
  acceptedBy,
  accepting,
  error,
  onAccept,
}: {
  match: BattleMatch;
  readyDeadline: string | null;
  skewMs: number;
  accepted: boolean;
  /** Players the server announced as accepted (match:ready). */
  acceptedBy: string[];
  accepting: boolean;
  error: string | null;
  onAccept: () => void;
}) {
  const now = useNow(250, !!readyDeadline);
  const opponentName = match.opponent?.displayName || match.opponent?.username || "your opponent";
  const remainingMs = readyDeadline ? Date.parse(readyDeadline) - (now + skewMs) : null;
  const seconds = remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000));

  let body: React.ReactNode;
  if (match.viewer === "SPECTATOR") {
    body = <p className="text-[14px] text-muted">Waiting for both players to accept.</p>;
  } else if (match.type !== "QUICK_MATCH") {
    body = (
      <p className="flex items-center justify-center gap-2 text-[14px] text-muted">
        <Spinner /> Waiting for the match to start…
      </p>
    );
  } else if (match.status === "READY") {
    body = (
      <p className="flex items-center justify-center gap-2 text-[14px] text-emerald-300">
        <Spinner /> Both players accepted - starting the match…
      </p>
    );
  } else if (accepted) {
    body = (
      <p className="flex items-center justify-center gap-2 text-[14px] text-muted">
        <Check size={16} className="text-emerald-400" /> Accepted. Waiting for {opponentName}…
      </p>
    );
  } else {
    body = (
      <>
        <button
          type="button"
          onClick={onAccept}
          disabled={accepting}
          className="btn btn-blue w-full !py-3 !text-[15px]"
          autoFocus
        >
          {accepting ? <Spinner /> : <Swords size={17} />} Accept Match
        </button>
        {error && (
          <p className="mt-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-200">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <p className="eyebrow text-blue-300">Match found</p>
      <h1 className="mt-1.5 text-[24px] font-extrabold tracking-[-0.02em]">Ready to battle?</h1>
      {seconds !== null ? (
        // The countdown changes every second: readable, but never announced.
        <p className="mt-2 text-[13px] text-muted" aria-live="off">
          Both players must accept within{" "}
          <span className={`font-bold tabular-nums ${seconds <= 3 ? "text-rose-300" : "text-fg"}`}>{seconds}s</span>
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-muted">Both players must accept within a few seconds.</p>
      )}

      <div className="mt-6 flex items-start justify-center gap-4">
        <Contender
          player={match.me}
          label={match.viewer === "SPECTATOR" ? "Player" : "You"}
          accepted={match.viewer === "SPECTATOR" ? !!match.me && acceptedBy.includes(match.me.id) : accepted}
        />
        <span className="mt-6 text-[22px] font-light italic text-dim">VS</span>
        <Contender
          player={match.opponent}
          label={match.viewer === "SPECTATOR" ? "Player" : "Opponent"}
          accepted={!!match.opponent && acceptedBy.includes(match.opponent.id)}
        />
      </div>

      <div className="mt-7">{body}</div>
      <p className="mt-5 text-[12px] text-dim">
        {match.ratingEligible ? "Ranked match - the result changes your rating." : "Casual match - ratings are not affected."}
      </p>
    </>
  );
}

function CancelledBeforeStart({
  match,
  accepted,
  readyCheckEnd,
}: {
  match: BattleMatch;
  accepted: boolean;
  readyCheckEnd: ReadyCheckEnd | null;
}) {
  const router = useRouter();
  const quickMatch = useQuickMatch();
  const { sync } = quickMatch;
  const queued = quickMatch.phase === "searching" || quickMatch.phase === "cancelling";
  const now = useNow(1000, queued);
  const opponentName = match.opponent?.displayName || match.opponent?.username || "Your opponent";

  // Whoever accepted is put back in the queue by the server: show that search.
  useEffect(() => {
    void sync();
  }, [sync]);

  let reason: string;
  if (match.finishReason === "SYSTEM_CANCELLED") {
    reason = "The match could not be started. Please try again in a moment.";
  } else if (readyCheckEnd === "opponent-unavailable" || accepted) {
    reason = `${opponentName} didn't accept in time.`;
  } else {
    reason = "The match was cancelled because it wasn't accepted in time.";
  }

  return (
    <>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose/15 text-rose-300">
        <X size={22} />
      </span>
      <h1 className="mt-3 text-[22px] font-extrabold tracking-[-0.02em]">Match cancelled</h1>
      <p className="mt-2 text-[14px] text-muted">{reason} No result was recorded.</p>

      {queued && (
        <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-blue/30 bg-blue/10 px-4 py-3 text-[13px] text-blue-200">
          <span className="dot-live" />
          <span>
            You&apos;re back in the queue ·{" "}
            <span className="tabular-nums" aria-live="off">
              {quickMatch.search ? formatElapsed(now - Date.parse(quickMatch.search.joinedAt)) : "0:00"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void quickMatch.cancel()}
            disabled={quickMatch.phase === "cancelling"}
            className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
          >
            Cancel search
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href="/lobby" className="btn btn-ghost">
          Back to Lobby
        </Link>
        {!queued && match.type === "QUICK_MATCH" && match.viewer !== "SPECTATOR" && (
          <button
            type="button"
            onClick={() => {
              router.push("/lobby");
              void quickMatch.start();
            }}
            disabled={quickMatch.phase === "starting"}
            className="btn btn-blue"
          >
            <Zap size={15} /> Find Another Match
          </button>
        )}
      </div>
    </>
  );
}

/**
 * What the battle page shows before a match starts: the Quick Match ready
 * check (both players accept before the deadline), then the battle itself -
 * or why it was called off.
 */
export function ReadyCheck({
  match,
  readyDeadline,
  skewMs,
  readyCheckEnd,
  acceptedBy,
  refresh,
}: {
  match: BattleMatch;
  readyDeadline: string | null;
  skewMs: number;
  readyCheckEnd: ReadyCheckEnd | null;
  /** Players the server announced as accepted (match:ready). */
  acceptedBy: string[];
  refresh: () => Promise<unknown>;
}) {
  const [acceptedHere, setAcceptedHere] = useState(false);
  // Also true when the accept came from another tab of this player.
  const accepted =
    acceptedHere || (match.viewer === "PARTICIPANT" && !!match.me && acceptedBy.includes(match.me.id));
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await matchesApi.ready(match.id);
      setAcceptedHere(true);
    } catch (e) {
      // INVALID_MATCH_STATE: the match already started or was cancelled; the
      // refresh below shows which.
      if (!(e instanceof ApiError && e.code === "INVALID_MATCH_STATE")) {
        setError(e instanceof ApiError ? e.message : "Could not accept the match. Try again.");
      }
    } finally {
      setAccepting(false);
      void refresh();
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-line px-4 py-2.5 sm:px-6">
        <Link href="/lobby" className="flex items-center gap-2">
          <Image src="/assets/logo.png" alt="" width={30} height={30} />
          <span className="text-[19px] font-bold">CodeClash</span>
        </Link>
        <span className="hidden h-6 w-px bg-line sm:block" />
        <span className="hidden text-[14px] text-muted sm:inline">
          {match.type === "QUICK_MATCH" ? "Quick Match" : "Battle"}
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <section className="card w-full max-w-[560px] p-6 text-center sm:p-8" aria-live="polite">
          {match.status === "CANCELLED" ? (
            <CancelledBeforeStart match={match} accepted={accepted} readyCheckEnd={readyCheckEnd} />
          ) : (
            <WaitingToStart
              match={match}
              readyDeadline={readyDeadline}
              skewMs={skewMs}
              accepted={accepted}
              acceptedBy={acceptedBy}
              accepting={accepting}
              error={error}
              onAccept={() => void accept()}
            />
          )}
        </section>
      </main>
    </div>
  );
}
