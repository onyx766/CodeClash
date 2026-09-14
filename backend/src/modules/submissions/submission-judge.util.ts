import { createHash } from 'crypto';
import { SubmissionStatus } from '@prisma/client';
import type { Challenge, ChallengeTestCase } from '@prisma/client';
import type {
  FunctionParameter,
  JsonValue,
  RunnerJobPayload,
  RunnerJobResult,
  RunnerTestCase,
  TestResultStatus,
} from '../challenges/challenge.types';

/** How many deterministic generated tests a scored submission adds, at most. */
export const GENERATED_TEST_COUNT = 5;

export interface JudgeJobOptions {
  /**
   * Seeds for generated tests derive from this, so both players on the same
   * MatchChallenge face identical generated tests and a re-run reproduces them.
   */
  seedKey: string;
  submissionId?: string;
  metadata: Record<string, unknown>;
}

/**
 * Builds a SUBMISSION job. The player's code, the reference solution and the
 * custom checker all travel to the runner as opaque strings; none of them is
 * ever executed in this process.
 */
export function buildJudgeJob(
  challenge: Challenge,
  testCases: ChallengeTestCase[],
  sourceCode: string,
  options: JudgeJobOptions,
): RunnerJobPayload {
  const tests: RunnerTestCase[] = [...testCases]
    .sort((a, b) => a.order - b.order)
    .map((testCase) => ({
      id: testCase.id,
      input: testCase.input as JsonValue,
      expectedOutput:
        testCase.expectedOutput === null ? undefined : (testCase.expectedOutput as JsonValue),
      hidden: testCase.isHidden,
      order: testCase.order,
    }));

  // Generated tests need both a deterministic generator and a reference
  // solution to derive the expected output from, and are only added to a
  // scored run - never to a practice run against public tests.
  const useGenerator =
    !!challenge.testGeneratorCode &&
    !!challenge.referenceSolutionCode &&
    tests.some((test) => test.hidden);

  return {
    jobType: 'SUBMISSION',
    challengeId: challenge.id,
    submissionId: options.submissionId,
    language: 'javascript',
    sourceCode,
    functionContract: {
      functionName: challenge.functionName,
      parameters: (challenge.parameters as unknown as FunctionParameter[]) ?? [],
      returnType: challenge.returnType,
    },
    judgeMethod: challenge.judgeMethod,
    referenceSolutionCode: challenge.referenceSolutionCode,
    customCheckerCode: challenge.customCheckerCode,
    generatorCode: challenge.testGeneratorCode,
    limits: {
      timeLimitMs: challenge.timeLimitMs,
      memoryLimitMb: challenge.memoryLimitMb,
      outputLimitKb: challenge.outputLimitKb,
    },
    tests,
    generatorSeeds: useGenerator
      ? deterministicSeeds(`${challenge.id}:${options.seedKey}`)
      : undefined,
    metadata: options.metadata,
  };
}

function deterministicSeeds(key: string): number[] {
  const digest = createHash('sha256').update(key).digest();
  return Array.from({ length: GENERATED_TEST_COUNT }, (_, index) =>
    digest.readUInt32BE(index * 4),
  );
}

const FAILURE_STATUS: Record<Exclude<TestResultStatus, 'PASSED'>, SubmissionStatus> = {
  WRONG_ANSWER: SubmissionStatus.WRONG_ANSWER,
  RUNTIME_ERROR: SubmissionStatus.RUNTIME_ERROR,
  TIME_LIMIT: SubmissionStatus.TIME_LIMIT,
  MEMORY_LIMIT: SubmissionStatus.MEMORY_LIMIT,
  OUTPUT_LIMIT: SubmissionStatus.OUTPUT_LIMIT,
  SYSTEM_ERROR: SubmissionStatus.SYSTEM_ERROR,
};

/**
 * The verdict of a scored run. ACCEPTED requires a well-formed result in which
 * every test passed and at least every stored test case was actually judged -
 * a verdict that is internally inconsistent, or that judged fewer tests than
 * were sent, is a SYSTEM_ERROR, never a solve.
 */
export function deriveSubmissionStatus(
  result: RunnerJobResult | null | undefined,
  expectedTestCount: number,
): SubmissionStatus {
  if (!result || result.ok === false) return SubmissionStatus.SYSTEM_ERROR;
  const tests = Array.isArray(result.tests) ? result.tests : [];

  const failing = tests.find((test) => test.status !== 'PASSED');
  if (failing) {
    return (
      FAILURE_STATUS[failing.status as Exclude<TestResultStatus, 'PASSED'>] ??
      SubmissionStatus.SYSTEM_ERROR
    );
  }

  const total = Number(result.totalTests ?? tests.length);
  const passed = Number(result.passedTests ?? 0);
  if (
    expectedTestCount < 1 ||
    tests.length < expectedTestCount ||
    total !== tests.length ||
    passed !== total
  ) {
    return SubmissionStatus.SYSTEM_ERROR;
  }
  return SubmissionStatus.ACCEPTED;
}

export function extractMetrics(result: RunnerJobResult) {
  const tests = Array.isArray(result.tests) ? result.tests : [];
  const memory = tests
    .map((test) => test.memoryKb)
    .filter((kb): kb is number => typeof kb === 'number');
  return {
    passedTests: Number(result.passedTests ?? 0),
    totalTests: Number(result.totalTests ?? tests.length),
    runtimeMs: Math.round(Number(result.runtimeMs ?? 0)),
    memoryUsedKb: memory.length ? Math.round(Math.max(...memory)) : null,
    runnerJobId: result.jobId ?? null,
  };
}

/**
 * Player-safe view of a runner result. Hidden tests are reduced to a
 * pass/fail status with no input, no expected value and no message - the
 * message can contain checker output that describes the expectation.
 */
export function toClientResult(result: RunnerJobResult, testCases: ChallengeTestCase[]) {
  const publicOrder = new Map(
    testCases.filter((t) => !t.isHidden).map((t) => [t.id, t.order]),
  );

  return {
    passedTests: result.passedTests ?? 0,
    totalTests: result.totalTests ?? testCases.length,
    runtimeMs: result.runtimeMs ?? 0,
    results: (result.tests ?? []).map((test) => ({
      hidden: test.hidden,
      // Public tests are identifiable so the UI can line them up with the
      // samples it already has; hidden ones stay anonymous.
      order: test.hidden ? null : (publicOrder.get(test.testId) ?? test.order),
      status: test.status,
      passed: test.status === 'PASSED',
      runtimeMs: test.runtimeMs,
      memoryKb: test.memoryKb ?? null,
      message: test.hidden ? null : (test.message ?? null),
    })),
  };
}
