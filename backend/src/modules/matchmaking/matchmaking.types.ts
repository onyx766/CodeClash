/**
 * Client-facing matchmaking state, distinct from MatchStatus (which is the
 * persisted Match/MatchParticipant lifecycle once a pair has actually been
 * created). RESERVED is an internal transient state between an atomic Redis
 * claim and the Postgres Match being created - never returned to a client.
 */
export enum MatchmakingStatus {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  RESERVED = 'RESERVED',
  MATCHED = 'MATCHED',
}

export interface RatingRange {
  min: number;
  max: number;
}

export interface SearchingState {
  status: MatchmakingStatus.SEARCHING;
  joinedAt: string;
  rating: number;
  ratingRange: RatingRange;
}

export interface MatchedState {
  status: MatchmakingStatus.MATCHED;
  matchId: string;
}

export interface IdleState {
  status: MatchmakingStatus.IDLE;
}

export type MatchmakingState = SearchingState | MatchedState | IdleState;

/** In-queue candidate, as read back from the two Redis ZSETs. */
export interface QueueEntry {
  userId: string;
  rating: number;
  joinedAt: number;
}

export interface OpponentSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  rating: number;
}

export interface MatchFoundPayload {
  matchId: string;
  status: 'PENDING_READY';
  opponent: OpponentSummary;
  readyDeadline: string;
}
