// Quick Match shapes (backend/src/modules/matchmaking/matchmaking.types.ts).

import type { BattleMatch } from "./battle";

export type RatingRange = { min: number; max: number };

export type MatchmakingState =
  | { status: "IDLE" }
  | { status: "SEARCHING"; joinedAt: string; rating: number; ratingRange: RatingRange }
  | { status: "MATCHED"; matchId: string };

export type MatchmakingResponse = { success: boolean; matchmaking: MatchmakingState };

export type OpponentSummary = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  rating: number;
};

/** matchmaking:match-found - both players must accept before readyDeadline. */
export type MatchFoundPayload = {
  matchId: string;
  status: "PENDING_READY";
  opponent: OpponentSummary;
  readyDeadline: string;
};

/** POST /matches/:id/ready */
export type ReadyResponse = { matchId: string; status: string };

/**
 * matchmaking:cancelled. With a matchId, a ready check failed: READY_TIMEOUT
 * goes to each player who had not accepted in time (they are not put back in
 * the queue), START_FAILED to both players when both accepted but the match
 * could not be started. Without one, the search itself ended: STALE (dropped
 * for a missing heartbeat) or JOINED_ROOM (the player took a room seat).
 * Older API versions send no reason.
 */
export type MatchmakingCancelledPayload = { matchId?: string; reason?: string };

/** A message for the player about their Quick Match search. */
export type QuickMatchNotice = {
  tone: "info" | "error";
  text: string;
  /** Where the player can resolve it, e.g. the room or match that blocks a search. */
  action?: { label: string; href: string };
  /** Offer to search again. */
  retry?: boolean;
};

/**
 * What matchmaking:cancelled means for the player's search. A failed ready
 * check only brings a notice - the player's search state is whatever the
 * server made of it - while a search that ended takes the player out of the
 * queue, with a notice when that was not their own doing.
 */
export function describeCancellation(
  payload: MatchmakingCancelledPayload | undefined,
): { readyCheck: true; notice: QuickMatchNotice } | { readyCheck: false; notice: QuickMatchNotice | null } {
  switch (payload?.reason) {
    case "READY_TIMEOUT":
      return {
        readyCheck: true,
        notice: { tone: "info", text: "You didn't accept the match in time, so it was cancelled.", retry: true },
      };
    case "START_FAILED":
      return {
        readyCheck: true,
        notice: { tone: "error", text: "The match could not be started. Please search again.", retry: true },
      };
    case "STALE":
      return {
        readyCheck: false,
        notice: { tone: "error", text: "You were removed from the queue because the connection was lost.", retry: true },
      };
    case "JOINED_ROOM":
      // Taking a seat in a private room ends the search, which is what the
      // player asked for - nothing to report.
      return { readyCheck: false, notice: null };
  }
  if (payload?.matchId) {
    return { readyCheck: true, notice: { tone: "info", text: "The match was cancelled before it started.", retry: true } };
  }
  return { readyCheck: false, notice: { tone: "info", text: "Your search has stopped.", retry: true } };
}

/** How a Quick Match ready check ended, as far as this player was told. */
export type ReadyCheckEnd = "cancelled" | "opponent-unavailable" | "ready-timeout" | "start-failed";

/** The ready check end a matchmaking:cancelled event reports. */
export function readyCheckEndFor(payload: MatchmakingCancelledPayload | undefined): ReadyCheckEnd {
  if (payload?.reason === "READY_TIMEOUT") return "ready-timeout";
  if (payload?.reason === "START_FAILED") return "start-failed";
  return "cancelled";
}

/** Why a Quick Match was called off before it started, from the battle page's point of view. */
export type ReadyCheckFailure = "start-failed" | "you-timed-out" | "opponent-timed-out" | "timed-out";

export function readyCheckFailure(
  match: Pick<BattleMatch, "viewer" | "finishReason" | "me">,
  end: ReadyCheckEnd | null,
  accepted: { me: boolean; opponent: boolean },
): ReadyCheckFailure {
  // Both accepted, so only starting the match can have failed.
  if (end === "start-failed" || match.finishReason === "SYSTEM_CANCELLED" || (accepted.me && accepted.opponent)) {
    return "start-failed";
  }
  if (match.viewer === "SPECTATOR") return "timed-out";
  if (end === "ready-timeout") return "you-timed-out";
  if (end === "opponent-unavailable" || accepted.me) return "opponent-timed-out";
  // After a reload no event says what happened, but the API's ready flags do.
  if (match.me?.ready === false) return "you-timed-out";
  return "timed-out";
}

/**
 * Who has accepted a Quick Match ready check, from everything the battle page
 * knows: the players' `ready` flags in GET /matches/:id (which survive a
 * reload), the match:ready events, and the accept this tab just made.
 */
export function readyCheckAcceptance(
  match: Pick<BattleMatch, "me" | "opponent">,
  announced: string[],
  acceptedHere = false,
): { me: boolean; opponent: boolean } {
  const accepted = (player: BattleMatch["me"]) => !!player && (player.ready === true || announced.includes(player.id));
  return { me: acceptedHere || accepted(match.me), opponent: accepted(match.opponent) };
}

const foundKey = (matchId: string) => `cc:match-found:${matchId}`;

// Older API versions leave the ready deadline out of GET /matches/:id, so the
// battle page falls back to the one in the match-found event the lobby
// received. Kept for the tab only.
export function rememberMatchFound(payload: MatchFoundPayload) {
  try {
    window.sessionStorage.setItem(foundKey(payload.matchId), JSON.stringify(payload));
  } catch {
    // storage unavailable - the battle page simply shows no countdown
  }
}

export function recallMatchFound(matchId: string): MatchFoundPayload | null {
  try {
    const raw = window.sessionStorage.getItem(foundKey(matchId));
    return raw ? (JSON.parse(raw) as MatchFoundPayload) : null;
  } catch {
    return null;
  }
}
