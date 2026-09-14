/**
 * Types mirroring the backend's admin challenge API
 * (backend/src/modules/admin-challenges). Kept as a hand-written mirror rather
 * than generated, matching how frontend/lib/api.ts works today.
 */

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "EXPERT";
export type ChallengeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ProblemType = "FUNCTION" | "STANDARD_IO";
export type JudgeMethod =
  | "EXACT"
  | "DEEP_EQUAL"
  | "CUSTOM_CHECKER"
  | "REFERENCE";
export type CreationMode = "MANUAL" | "AI" | "JSON_IMPORT";
export type ValidationStatus = "NOT_CHECKED" | "PASSED" | "FAILED";

export type ValueType =
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "number[]"
  | "string[]"
  | "boolean[]"
  | "array"
  | "object"
  | "any";

export interface FunctionParameter {
  name: string;
  type: ValueType;
}

export interface FunctionContract {
  functionName: string;
  parameters: FunctionParameter[];
  returnType: ValueType;
  starterCode: string;
}

export interface ExecutionLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
  outputLimitKb: number;
}

export interface AdminTestCase {
  id?: string;
  order: number;
  isHidden: boolean;
  input: unknown;
  expectedOutput: unknown;
}

export interface ValidationFailureDetail {
  order: number;
  hidden: boolean;
  status: string;
  input?: unknown;
  expectedOutput?: unknown;
  actualOutput?: unknown;
  message?: string | null;
}

export type ValidationCheckName =
  | "CHALLENGE_SCHEMA"
  | "FUNCTION_CONTRACT"
  | "EXECUTION_LIMITS"
  | "JUDGE_CONFIGURATION"
  | "TEST_COUNTS"
  | "STARTER_CODE"
  | "REFERENCE_SOLUTION"
  | "CUSTOM_CHECKER"
  | "PUBLIC_TESTS"
  | "HIDDEN_TESTS"
  | "GENERATOR"
  | "GENERATOR_DETERMINISM"
  | "READY_TO_PUBLISH";

export interface ValidationCheck {
  name: ValidationCheckName;
  passed: boolean;
  skipped?: boolean;
  message?: string | null;
  passedCount?: number;
  totalCount?: number;
  failures?: ValidationFailureDetail[];
}

export interface AdminChallenge {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  problemType: ProblemType;
  tags: { slug: string; label: string }[];
  functionContract: FunctionContract;
  judge: {
    method: JudgeMethod;
    referenceSolutionCode: string | null;
    customCheckerCode: string | null;
    testGeneratorCode: string | null;
  };
  limits: ExecutionLimits;
  roundTimeLimitSeconds: number;
  testCases: AdminTestCase[];
  status: ChallengeStatus;
  creationMode: CreationMode;
  validation: {
    status: ValidationStatus;
    validatedAt: string | null;
    checks: ValidationCheck[];
  };
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

export interface AdminChallengeSummary {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  status: ChallengeStatus;
  creationMode: CreationMode;
  judgeMethod: JudgeMethod;
  validationStatus: ValidationStatus;
  tags: string[];
  publicTestCount: number;
  hiddenTestCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/** GET /api/admin/challenges/battle-pool - one row per challenge. */
export interface BattlePoolChallenge {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  status: ChallengeStatus;
  validationStatus: ValidationStatus;
  validatedAt: string | null;
  hiddenTestCount: number;
  eligible: boolean;
  /** Why the challenge is excluded from battles; empty when eligible. */
  problems: string[];
}

export interface BattlePool {
  requireValidated: boolean;
  challengeCount: number;
  distribution: Record<Difficulty, number>;
  durationMinutes: number;
  eligibleCount: number;
  eligibleByDifficulty: Record<Difficulty, number>;
  canStartMatch: boolean;
  needsValidationCount: number;
  runner: { reachable: boolean; message: string; workers: number | null };
  challenges: BattlePoolChallenge[];
}

export type BatchOutcome = "PASSED" | "FAILED" | "ERROR" | "SKIPPED";

export interface BatchValidationResponse {
  results: { id: string; title: string; outcome: BatchOutcome; message: string | null }[];
  summary: Record<BatchOutcome, number>;
}

/** Request body shared by POST / PATCH /api/admin/challenges. */
export interface UpsertChallengePayload {
  title?: string;
  slug?: string;
  description?: string;
  difficulty?: Difficulty;
  problemType?: ProblemType;
  tags?: string[];
  functionContract?: FunctionContract;
  judgeMethod?: JudgeMethod;
  referenceSolutionCode?: string | null;
  customCheckerCode?: string | null;
  testGeneratorCode?: string | null;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  outputLimitKb?: number;
  timeLimitSeconds?: number;
  testCases?: {
    input: unknown;
    expectedOutput?: unknown;
    isHidden?: boolean;
  }[];
}

export interface AiGenerateRequest {
  topic: string;
  difficulty: Difficulty;
  tags?: string[];
  concept?: string;
  publicTestCount?: number;
  hiddenTestCount?: number;
  instructions?: string;
}

export type UserRole = "USER" | "ADMIN" | "MASTER";
export type UserStatus = "ACTIVE" | "BANNED";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// user management
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  /** Null when the account has no stats row yet. */
  rating: number | null;
  matchesPlayed: number;
  country: string | null;
  region: string | null;
  city: string | null;
  createdAt: string;
  /** Null when the account has never signed in. */
  lastActiveAt: string | null;
  bannedAt: string | null;
  banReason: string | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UserStatCard {
  value: number;
  changeThisMonth: number;
  /** Null when there is no baseline to compare against. */
  percentChange: number | null;
}

export interface UserStats {
  total: UserStatCard;
  active: UserStatCard;
  newUsers: UserStatCard;
  banned: UserStatCard;
}

export type JoinWindow = "24h" | "7d" | "30d" | "90d" | "1y";
export type UserSortField = "createdAt" | "lastActiveAt" | "username" | "rating";

export interface ListUsersQuery {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  joinedWithin?: JoinWindow;
  page?: number;
  pageSize?: number;
  sortBy?: UserSortField;
  sortDir?: "asc" | "desc";
}

export interface CreateUserPayload {
  email: string;
  username: string;
  password: string;
  role?: UserRole;
}

/** GET /api/admin/users/:id - the edit panel's view of one account. */
export interface AdminUserDetail extends AdminUser {
  profile: {
    displayName: string | null;
    bio: string | null;
    location: string | null;
    avatarUrl: string | null;
  };
  /** Derived from match results. Shown read-only - never editable here. */
  stats: {
    rating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    currentStreak: number;
    bestStreak: number;
    challengesSolved: number;
    coins: number;
    xp: number;
  } | null;
  sessionsRevokedAt: string | null;
}

/**
 * PATCH /api/admin/users/:id. Send only the fields that changed; an empty
 * string clears an optional profile field.
 */
export interface AdminUpdateUserPayload {
  username?: string;
  email?: string;
  displayName?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  country?: string;
  region?: string;
  city?: string;
}
