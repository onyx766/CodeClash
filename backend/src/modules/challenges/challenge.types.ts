import type { JudgeMethod } from '@prisma/client';
import type { SupportedValueType } from './challenge.constants';

/** JSON-compatible value. Test inputs/outputs are stored and shipped as these. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface FunctionParameter {
  name: string;
  type: SupportedValueType;
}

export interface FunctionContract {
  functionName: string;
  /**
   * Ordered. The runner rebuilds the positional argument list as
   * `parameters.map((p) => input[p.name])`, so this order is the calling
   * convention - not the parameter names in the admin's starter code.
   */
  parameters: FunctionParameter[];
  returnType: string;
}

export interface ExecutionLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
  outputLimitKb: number;
}

export interface RunnerTestCase {
  id: string;
  /** Object keyed by contract parameter name. */
  input: JsonValue;
  /** Absent when the reference solution or the custom checker decides. */
  expectedOutput?: JsonValue;
  hidden: boolean;
  order: number;
}

export type RunnerJobType = 'CHALLENGE_VALIDATION' | 'SUBMISSION';

/**
 * The one payload shape the backend ever sends to the isolated code runner.
 *
 * Everything executable (`sourceCode`, `referenceSolutionCode`,
 * `customCheckerCode`, `generatorCode`, and the starter code syntax check)
 * travels as an opaque string and is only ever executed inside the runner's
 * container. NestJS never evaluates any of it.
 */
export interface RunnerJobPayload {
  jobType: RunnerJobType;
  challengeId: string;
  submissionId?: string;
  language: 'javascript';
  /** Player-submitted code. SUBMISSION jobs only. */
  sourceCode?: string;
  functionContract: FunctionContract;
  judgeMethod: JudgeMethod;
  /** Syntax-checked during validation; never executed as a solution. */
  starterCode?: string;
  referenceSolutionCode?: string | null;
  customCheckerCode?: string | null;
  generatorCode?: string | null;
  limits: ExecutionLimits;
  tests: RunnerTestCase[];
  /** Deterministic seeds handed to `generate(seed)`. Validation jobs only. */
  generatorSeeds?: number[];
  metadata?: Record<string, unknown>;
}

export type TestResultStatus =
  | 'PASSED'
  | 'WRONG_ANSWER'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT'
  | 'MEMORY_LIMIT'
  | 'OUTPUT_LIMIT'
  | 'SYSTEM_ERROR';

export interface RunnerTestResult {
  testId: string;
  hidden: boolean;
  order: number;
  status: TestResultStatus;
  runtimeMs: number;
  memoryKb?: number;
  /** Short diagnostic. Never forwarded to a player for a hidden test. */
  message?: string | null;
}

export type ValidationCheckName =
  | 'CHALLENGE_SCHEMA'
  | 'FUNCTION_CONTRACT'
  | 'EXECUTION_LIMITS'
  | 'JUDGE_CONFIGURATION'
  | 'TEST_COUNTS'
  | 'STARTER_CODE'
  | 'REFERENCE_SOLUTION'
  | 'CUSTOM_CHECKER'
  | 'PUBLIC_TESTS'
  | 'HIDDEN_TESTS'
  | 'GENERATOR'
  | 'GENERATOR_DETERMINISM'
  | 'READY_TO_PUBLISH';

export interface ValidationCheck {
  name: ValidationCheckName;
  passed: boolean;
  /** Omitted when the check does not apply (e.g. no generator configured). */
  skipped?: boolean;
  message?: string | null;
  passedCount?: number;
  totalCount?: number;
  /** Per-test detail for a failed test batch. Admin-only. */
  failures?: ValidationFailureDetail[];
}

export interface ValidationFailureDetail {
  order: number;
  hidden: boolean;
  status: TestResultStatus;
  input?: JsonValue;
  expectedOutput?: JsonValue;
  actualOutput?: JsonValue;
  message?: string | null;
}

/** What the runner returns for either job type. */
export interface RunnerJobResult {
  jobId: string;
  jobType: RunnerJobType;
  ok: boolean;
  /** Populated for CHALLENGE_VALIDATION jobs. */
  checks?: ValidationCheck[];
  /** Populated for SUBMISSION jobs. */
  tests?: RunnerTestResult[];
  passedTests?: number;
  totalTests?: number;
  runtimeMs?: number;
  error?: string | null;
}
