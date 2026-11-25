"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import useQuickMatch from "../../hooks/useQuickMatch";
import useNow, { formatElapsed } from "../../hooks/useNow";

/**
 * Shown on other pages while a Quick Match search runs, so the player knows
 * they are still queued (a found match opens automatically) and can stop it.
 */
export default function QuickMatchIndicator() {
  const pathname = usePathname();
  const { phase, search, cancel } = useQuickMatch();
  const queued = phase === "searching" || phase === "cancelling";
  const now = useNow(1000, queued);

  // The lobby card and the battle page show the search themselves.
  if (!queued || pathname === "/lobby" || pathname.startsWith("/match/")) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-xl border border-blue/30 bg-surface/95 px-4 py-3 shadow-xl backdrop-blur-xl"
    >
      <span className="dot-live" />
      <div className="text-[12.5px] leading-tight">
        <p className="font-semibold">Searching for an opponent</p>
        <p className="mt-0.5 tabular-nums text-dim">
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
