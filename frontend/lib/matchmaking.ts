// Quick Match shapes (backend/src/modules/matchmaking/matchmaking.types.ts).

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
