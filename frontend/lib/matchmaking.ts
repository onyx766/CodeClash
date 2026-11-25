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
