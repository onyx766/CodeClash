"use client";

import Link from "next/link";
import { X } from "lucide-react";
import useQuickMatch from "../../hooks/useQuickMatch";
import useNow, { formatElapsed } from "../../hooks/useNow";

/**
 * Shown on every page while a Quick Match search runs, so the player knows
 * they are still queued (a found match opens automatically) and can stop it -
 * also on a finished match opened from the history.
 */
export default function QuickMatchIndicator() {
  const { phase, search, cancel, searchShownOnPage } = useQuickMatch();
  const queued = phase === "searching" || phase === "cancelling";
  const now = useNow(1000, queued);

  // Redundant where the page shows the search itself: the lobby card, or the
  // battle page of a ready check that failed and put the player back in the
  // queue. (A found match ends the search, so the ready check and the battle
  // it leads to never show one.)
  if (!queued || searchShownOnPage) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-xl border border-blue/30 bg-surface/95 px-4 py-3 shadow-xl backdrop-blur-xl"
    >
      <span className="dot-live" />
      <div className="text-[12.5px] leading-tight">
        <p className="font-semibold">Searching for an opponent</p>
        {/* Ticks every second: readable, but never announced by the status region. */}
        <p className="mt-0.5 tabular-nums text-dim" aria-live="off">
          {search ? formatElapsed(now - Date.parse(search.joinedAt)) : "0:00"}
        </p>
      </div>
      <Link href="/lobby" className="btn btn-ghost !px-3 !py-1.5 !text-[12px]">
        Lobby
      </Link>
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={phase === "cancelling"}
        aria-label="Cancel search"
        className="btn btn-ghost !p-1.5"
      >
        <X size={15} />
      </button>
    </div>
  );
}
