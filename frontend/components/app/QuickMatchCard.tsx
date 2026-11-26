"use client";

import { Loader2, Trophy, X, Zap } from "lucide-react";
import useQuickMatch, { useShowsQuickMatchSearch } from "../../hooks/useQuickMatch";
import useNow, { formatElapsed } from "../../hooks/useNow";

/** The lobby's Quick Match card: find a ranked opponent, or follow the search in progress. */
export default function QuickMatchCard() {
  const { phase, search, start, cancel } = useQuickMatch();
  useShowsQuickMatchSearch();
  const queued = phase === "searching" || phase === "cancelling";
  const now = useNow(1000, queued);
  const elapsed = search ? formatElapsed(now - Date.parse(search.joinedAt)) : "0:00";

  return (
    <div className="card flex flex-col items-center border-blue/30 bg-gradient-to-b from-[#101a3a] to-[#0b1020] p-5 text-center">
      <span className="inline-flex h-[62px] w-[62px] items-center justify-center rounded-full bg-gradient-to-br from-blue to-blue-deep text-white shadow-lg">
        {queued ? <Loader2 size={26} strokeWidth={2.2} className="animate-spin" /> : <Zap size={26} strokeWidth={2.2} />}
      </span>
      <h2 className="mt-4 text-[17px] font-bold">Quick Match</h2>

      {queued ? (
        <>
          <p className="mx-auto mt-2 max-w-[220px] text-[12.5px] leading-relaxed text-dim" aria-live="polite">
            Searching for an opponent near your rating…
          </p>
          <p className="mt-2 text-[24px] font-extrabold leading-none tabular-nums">{elapsed}</p>
          {search && (
            <p className="mt-1.5 text-[11.5px] text-dim">
              Rating range {search.ratingRange.min}–{search.ratingRange.max}
            </p>
          )}
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={phase === "cancelling"}
            className="btn btn-ghost mt-4 w-full"
          >
            <X size={15} /> {phase === "cancelling" ? "Cancelling…" : "Cancel Search"}
          </button>
        </>
      ) : (
        <>
          <p className="mx-auto mt-2 max-w-[220px] text-[12.5px] leading-relaxed text-dim">
            Find an opponent of similar skill and start a ranked battle.
          </p>
          <button
            type="button"
            onClick={() => void start()}
            disabled={phase === "starting"}
            className="btn btn-blue mt-5 w-full"
          >
            <Zap size={15} /> {phase === "starting" ? "Joining queue…" : "Find Match"}
          </button>
        </>
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-dim">
        {queued ? (
          <>
            <span className="dot-live" /> In queue · keep this tab open
          </>
        ) : (
          <>
            <Trophy size={13} /> Ranked · your rating is on the line
          </>
        )}
      </p>
    </div>
  );
}
