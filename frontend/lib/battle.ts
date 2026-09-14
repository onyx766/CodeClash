// Shapes returned by the backend battle API (backend/src/modules/matches and
// modules/submissions). The server is authoritative for every value here -
// the client never computes solved counts, winners or rating changes.

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "EXPERT";
export type ChallengeStatus = "NOT_STARTED" | "ATTEMPTING" | "SOLVED";
export type MatchStatus =
  | "PENDING"
  | "PENDING_READY"
  | "READY"
  | "IN_PROGRESS"
  | "FINISHED"
  | "CANCELLED"
  | "ABANDONED"
  | "EXPIRED";
export type FinishReason =
  | "ALL_CHALLENGES_SOLVED"
  | "PLAYER_GAVE_UP"
  | "TIME_EXPIRED"
  | "SYSTEM_CANCELLED"
  | "OPPONENT_DISCONNECTED";
export type SubmissionStatus =
  | "QUEUED"
  | "RUNNING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "RUNTIME_ERROR"
  | "TIME_LIMIT"
  | "MEMORY_LIMIT"
  | "OUTPUT_LIMIT"
  | "SYSTEM_ERROR";

export interface BattlePlayer {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  rating: number;
  ratingAfter: number | null;
  solved: number;
  total: number;
  totalSolveDurationMs: number;
  gaveUp: boolean;
}

export interface BattleChallenge {
  matchChallengeId: string;
  position: number;
  challenge: { id: string; slug: string; title: string; difficulty: Difficulty };
  myProgress: {
    status: ChallengeStatus;
    attempts: number;
    firstAttemptAt: string | null;
    solvedAt: string | null;
    solveDurationMs: number | null;
  };
  opponentProgress: { status: ChallengeStatus; solvedAt: string | null };
}

export interface MatchLogEntry {
  at: string;
  offsetMs: number;
  type: "MATCH_STARTED" | "CHALLENGE_SOLVED" | "PLAYER_GAVE_UP" | "MATCH_FINISHED" | "MATCH_CANCELLED";
  userId?: string;
  matchChallengeId?: string;
  challengeTitle?: string;
  winnerId?: string | null;
  resultType?: "WIN" | "DRAW" | null;
  finishReason?: FinishReason | null;
}

export interface BattleMatch {
  id: string;
  code: string;
  type: "QUICK_MATCH" | "PRIVATE_ROOM";
  mode: "RANKED" | "CASUAL";
  status: MatchStatus;
  ratingEligible: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  finishedAt: string | null;
  finishReason: FinishReason | null;
  resultType: "WIN" | "DRAW" | null;
  winnerId: string | null;
  serverTime: string;
  viewer: "PARTICIPANT" | "SPECTATOR";
  me: BattlePlayer | null;
  opponent: BattlePlayer | null;
  challenges: BattleChallenge[];
  log: MatchLogEntry[];
}

export interface ChallengeStatement {
  matchChallengeId: string;
  position: number;
  challenge: {
    id: string;
    slug: string;
    title: string;
    description: string;
    difficulty: Difficulty;
    functionName: string;
    parameters: { name: string; type: string }[];
    returnType: string;
    starterCode: string;
    limits: { timeLimitMs: number; memoryLimitMb: number; outputLimitKb: number };
    sampleTestCases: { order: number; input: Record<string, unknown>; expectedOutput: unknown }[];
  };
}

export interface TestRunResult {
  passedTests: number;
  totalTests: number;
  runtimeMs: number;
  results: {
    hidden: boolean;
    order: number | null;
    status: string;
    passed: boolean;
    runtimeMs: number;
    memoryKb: number | null;
    message: string | null;
  }[];
}

export interface SubmitResponse {
  submission: {
    id: string;
    status: SubmissionStatus;
    passedTests: number | null;
    totalTests: number | null;
    runtimeMs: number | null;
  } | null;
  solved: boolean;
  matchFinished: boolean;
  results: TestRunResult;
}

export const ACTIVE_MATCH_STATUSES: MatchStatus[] = ["PENDING", "PENDING_READY", "READY", "IN_PROGRESS"];

export const VERDICT_LABEL: Record<string, string> = {
  ACCEPTED: "Accepted",
  WRONG_ANSWER: "Wrong Answer",
  RUNTIME_ERROR: "Runtime Error",
  TIME_LIMIT: "Time Limit Exceeded",
  MEMORY_LIMIT: "Memory Limit Exceeded",
  OUTPUT_LIMIT: "Output Limit Exceeded",
  SYSTEM_ERROR: "System Error",
  PASSED: "Passed",
};

/** "28:41", or "1:02:05" past an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Elapsed time since match start, as the Match Log shows it: "04:18". */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
