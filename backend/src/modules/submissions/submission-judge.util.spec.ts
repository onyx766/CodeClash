import { JudgeMethod } from '@prisma/client';
import type { Challenge, ChallengeTestCase } from '@prisma/client';
import type { RunnerJobResult, RunnerTestResult } from '../challenges/challenge.types';
import { buildJudgeJob, deriveSubmissionStatus, extractMetrics, toClientResult } from './submission-judge.util';

const HIDDEN_EXPECTATION = [7, 7];

const challenge = {
  id: 'challenge-1',
  functionName: 'solve',
  parameters: [
    { name: 'nums', type: 'number[]' },
    { name: 'target', type: 'number' },
  ],
  returnType: 'number[]',
  judgeMethod: JudgeMethod.DEEP_EQUAL,
  referenceSolutionCode: 'function solve() { return []; } // SECRET',
  customCheckerCode: null,
  testGeneratorCode: null,
  timeLimitMs: 2000,
  memoryLimitMb: 128,
  outputLimitKb: 64,
} as unknown as Challenge;

const testCases = [
  { id: 't1', order: 0, isHidden: false, input: { nums: [2, 7], target: 9 }, expectedOutput: [0, 1] },
  { id: 't2', order: 1, isHidden: true, input: { nums: [7, 7], target: 14 }, expectedOutput: HIDDEN_EXPECTATION },
  { id: 't3', order: 2, isHidden: true, input: { nums: [1], target: 5 }, expectedOutput: [] },
] as unknown as ChallengeTestCase[];

function result(statuses: RunnerTestResult['status'][], extra: Partial<RunnerJobResult> = {}): RunnerJobResult {
  const tests = statuses.map((status, i) => ({
    testId: `t${i + 1}`,
    hidden: i > 0,
    order: i,
    status,
    runtimeMs: 2,
    memoryKb: 1000 + i,
    message: status === 'PASSED' ? null : 'Expected [] but received [7,7]',
  }));
  return {
    jobId: 'job-1',
    jobType: 'SUBMISSION',
    ok: true,
    passedTests: statuses.filter((s) => s === 'PASSED').length,
    totalTests: statuses.length,
    runtimeMs: 6,
    tests,
    ...extra,
  };
}

describe('deriveSubmissionStatus', () => {
  it('is ACCEPTED only when every test ran and passed', () => {
    expect(deriveSubmissionStatus(result(['PASSED', 'PASSED', 'PASSED']), 3)).toBe('ACCEPTED');
  });

  it('reports the first failing test’s status', () => {
    expect(deriveSubmissionStatus(result(['PASSED', 'WRONG_ANSWER', 'TIME_LIMIT']), 3)).toBe('WRONG_ANSWER');
    expect(deriveSubmissionStatus(result(['RUNTIME_ERROR', 'PASSED', 'PASSED']), 3)).toBe('RUNTIME_ERROR');
    expect(deriveSubmissionStatus(result(['PASSED', 'MEMORY_LIMIT', 'PASSED']), 3)).toBe('MEMORY_LIMIT');
    expect(deriveSubmissionStatus(result(['PASSED', 'PASSED', 'OUTPUT_LIMIT']), 3)).toBe('OUTPUT_LIMIT');
  });

  it('never accepts a failed, empty, short or inconsistent verdict', () => {
    expect(deriveSubmissionStatus(result(['PASSED'], { ok: false }), 1)).toBe('SYSTEM_ERROR');
    expect(deriveSubmissionStatus(result([]), 3)).toBe('SYSTEM_ERROR');
    expect(deriveSubmissionStatus(result(['PASSED', 'PASSED']), 3)).toBe('SYSTEM_ERROR');
    expect(deriveSubmissionStatus(result(['PASSED', 'PASSED', 'PASSED'], { passedTests: 2 }), 3)).toBe('SYSTEM_ERROR');
    expect(deriveSubmissionStatus(result(['PASSED', 'PASSED', 'PASSED'], { totalTests: 9 }), 3)).toBe('SYSTEM_ERROR');
    expect(deriveSubmissionStatus(null, 3)).toBe('SYSTEM_ERROR');
  });

  it('accepts extra generated tests on top of the stored ones', () => {
    expect(deriveSubmissionStatus(result(['PASSED', 'PASSED', 'PASSED', 'PASSED', 'PASSED']), 3)).toBe('ACCEPTED');
  });
});

describe('extractMetrics', () => {
  it('reads counts, runtime, peak memory and the runner job id', () => {
    expect(extractMetrics(result(['PASSED', 'PASSED', 'WRONG_ANSWER']))).toEqual({
      passedTests: 2,
      totalTests: 3,
      runtimeMs: 6,
      memoryUsedKb: 1002,
      runnerJobId: 'job-1',
    });
  });
});

describe('buildJudgeJob', () => {
  it('sends only what it is given, and adds no generated tests to a public run', () => {
    const job = buildJudgeJob(challenge, testCases.filter((t) => !t.isHidden), 'code', {
      seedKey: 'mc-1',
      metadata: {},
    });
    expect(job.tests).toHaveLength(1);
    expect(job.generatorSeeds).toBeUndefined();
  });

  it('gives both players on a MatchChallenge the same generated tests', () => {
    const withGenerator = { ...challenge, testGeneratorCode: 'function generate(seed) { return {}; }' } as Challenge;
    const a = buildJudgeJob(withGenerator, testCases, 'a', { seedKey: 'mc-1', metadata: {} });
    const b = buildJudgeJob(withGenerator, testCases, 'b', { seedKey: 'mc-1', metadata: {} });
    const other = buildJudgeJob(withGenerator, testCases, 'a', { seedKey: 'mc-2', metadata: {} });
    expect(a.generatorSeeds).toHaveLength(5);
    expect(a.generatorSeeds).toEqual(b.generatorSeeds);
    expect(a.generatorSeeds).not.toEqual(other.generatorSeeds);
  });

  it('omits seeds without a reference solution', () => {
    const noReference = {
      ...challenge,
      testGeneratorCode: 'function generate(seed) { return {}; }',
      referenceSolutionCode: null,
    } as Challenge;
    expect(buildJudgeJob(noReference, testCases, 'x', { seedKey: 'mc-1', metadata: {} }).generatorSeeds).toBeUndefined();
  });
});

describe('toClientResult', () => {
  it('never returns hidden inputs, expectations or messages', () => {
    const client = toClientResult(result(['PASSED', 'PASSED', 'WRONG_ANSWER']), testCases);
    const serialized = JSON.stringify(client);
    expect(serialized).not.toContain('Expected [] but received');
    expect(serialized).not.toContain('"nums"');

    const hidden = client.results.filter((r) => r.hidden);
    expect(hidden).toHaveLength(2);
    for (const test of hidden) {
      expect(test.message).toBeNull();
      expect(test.order).toBeNull();
    }
    expect(hidden.map((t) => t.status)).toEqual(['PASSED', 'WRONG_ANSWER']);
  });

  it('keeps public test detail visible', () => {
    const client = toClientResult(result(['WRONG_ANSWER', 'PASSED', 'PASSED']), testCases);
    const publicResult = client.results.find((r) => !r.hidden)!;
    expect(publicResult).toMatchObject({ order: 0, passed: false, message: 'Expected [] but received [7,7]' });
  });
});
