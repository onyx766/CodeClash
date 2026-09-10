import { Test, TestingModule } from '@nestjs/testing';
import {
  ChallengeCreationMode,
  ChallengeStatus,
  ChallengeValidationStatus,
  Difficulty,
  JudgeMethod,
} from '@prisma/client';
import { ChallengeValidationService } from './challenge-validation.service';
import { AdminChallengesService } from './admin-challenges.service';
import { PrismaService } from '../../database/prisma.service';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import { ChallengeValidationFailedException } from '../../common/exceptions/app.exception';
import type { RunnerJobPayload, ValidationCheck } from '../challenges/challenge.types';

const RUNNER_PASSES: ValidationCheck[] = [
  { name: 'STARTER_CODE', passed: true },
  { name: 'REFERENCE_SOLUTION', passed: true },
  { name: 'CUSTOM_CHECKER', passed: true, skipped: true },
  { name: 'PUBLIC_TESTS', passed: true, passedCount: 1, totalCount: 1 },
  { name: 'HIDDEN_TESTS', passed: true, passedCount: 3, totalCount: 3 },
  { name: 'GENERATOR', passed: true, skipped: true },
  { name: 'GENERATOR_DETERMINISM', passed: true, skipped: true },
];

function challengeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge-1',
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Return the indices of the two numbers that add up to target.',
    difficulty: Difficulty.EASY,
    problemType: 'FUNCTION',
    functionName: 'solve',
    parameters: [
      { name: 'nums', type: 'number[]' },
      { name: 'target', type: 'number' },
    ],
    returnType: 'number[]',
    starterCode: 'function solve(nums, target) {}',
    judgeMethod: JudgeMethod.DEEP_EQUAL,
    customCheckerCode: null,
    referenceSolutionCode: 'function solve(nums, target) { return []; }',
    testGeneratorCode: null,
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    outputLimitKb: 64,
    timeLimitSeconds: 300,
    status: ChallengeStatus.DRAFT,
    creationMode: ChallengeCreationMode.MANUAL,
    validationStatus: ChallengeValidationStatus.NOT_CHECKED,
    validatedAt: null,
    validationChecks: null,
    validationFingerprint: null,
    createdById: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    archivedAt: null,
    tags: [],
    testCases: [
      { id: 't1', order: 0, isHidden: false, input: { nums: [2, 7], target: 9 }, expectedOutput: [0, 1] },
      { id: 't2', order: 1, isHidden: true, input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1] },
      { id: 't3', order: 2, isHidden: true, input: { nums: [1, 2], target: 9 }, expectedOutput: [] },
      { id: 't4', order: 3, isHidden: true, input: { nums: [], target: 0 }, expectedOutput: [] },
    ],
    ...overrides,
  };
}

describe('ChallengeValidationService', () => {
  let service: ChallengeValidationService;
  let admin: AdminChallengesService;
  let prisma: any;
  let runner: { trySubmit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      challenge: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      challengeTag: { upsert: jest.fn() },
      round: { count: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    runner = {
      trySubmit: jest.fn().mockResolvedValue({
        jobId: 'job-1',
        jobType: 'CHALLENGE_VALIDATION',
        ok: true,
        checks: RUNNER_PASSES,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeValidationService,
        AdminChallengesService,
        { provide: PrismaService, useValue: prisma },
        { provide: JudgeRunnerClient, useValue: runner },
      ],
    }).compile();

    service = module.get(ChallengeValidationService);
    admin = module.get(AdminChallengesService);
  });

  it('sends a CHALLENGE_VALIDATION job to the runner instead of executing anything locally', async () => {
    prisma.challenge.findUnique.mockResolvedValue(challengeRow());

    await service.validate('challenge-1');

    expect(runner.trySubmit).toHaveBeenCalledTimes(1);
    const payload: RunnerJobPayload = runner.trySubmit.mock.calls[0][0];
    expect(payload.jobType).toBe('CHALLENGE_VALIDATION');
    expect(payload.challengeId).toBe('challenge-1');
    // Executable challenge code travels as opaque strings for the runner.
    expect(payload.referenceSolutionCode).toBe(
      'function solve(nums, target) { return []; }',
    );
    expect(payload.starterCode).toBe('function solve(nums, target) {}');
    expect(payload.functionContract.parameters).toHaveLength(2);
    expect(payload.limits).toEqual({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      outputLimitKb: 64,
    });
    expect(payload.tests).toHaveLength(4);
  });

  it('records PASSED and a fingerprint when every check passes', async () => {
    const row = challengeRow();
    prisma.challenge.findUnique.mockResolvedValue(row);

    const result = await service.validate('challenge-1');

    expect(result.validation.status).toBe(ChallengeValidationStatus.PASSED);
    const data = prisma.challenge.update.mock.calls[0][0].data;
    expect(data.validationStatus).toBe(ChallengeValidationStatus.PASSED);
    expect(data.validationFingerprint).toBe(admin.fingerprint(row as never));
    expect(
      (data.validationChecks as ValidationCheck[]).find(
        (c) => c.name === 'READY_TO_PUBLISH',
      )?.passed,
    ).toBe(true);
  });

  it('records FAILED with no fingerprint when the runner reports a failing test', async () => {
    prisma.challenge.findUnique.mockResolvedValue(challengeRow());
    runner.trySubmit.mockResolvedValue({
      jobId: 'job-1',
      jobType: 'CHALLENGE_VALIDATION',
      ok: true,
      checks: [
        ...RUNNER_PASSES.filter((c) => c.name !== 'HIDDEN_TESTS'),
        {
          name: 'HIDDEN_TESTS',
          passed: false,
          passedCount: 2,
          totalCount: 3,
          message: 'Reference solution failed test #7.',
        },
      ],
    });

    const result = await service.validate('challenge-1');

    expect(result.validation.status).toBe(ChallengeValidationStatus.FAILED);
    const data = prisma.challenge.update.mock.calls[0][0].data;
    // No fingerprint means publish() can never accept this run.
    expect(data.validationFingerprint).toBeNull();
  });

  it('fails static checks without calling the runner at all', async () => {
    prisma.challenge.findUnique.mockResolvedValue(
      challengeRow({ functionName: 'not a function name' }),
    );

    const result = await service.validate('challenge-1');

    expect(runner.trySubmit).not.toHaveBeenCalled();
    expect(result.validation.status).toBe(ChallengeValidationStatus.FAILED);
    expect(
      result.validation.checks.find((c) => c.name === 'FUNCTION_CONTRACT')?.passed,
    ).toBe(false);
  });

  it('requires checker code for the CUSTOM_CHECKER judge method', async () => {
    prisma.challenge.findUnique.mockResolvedValue(
      challengeRow({ judgeMethod: JudgeMethod.CUSTOM_CHECKER, customCheckerCode: null }),
    );

    const result = await service.validate('challenge-1');

    expect(
      result.validation.checks.find((c) => c.name === 'JUDGE_CONFIGURATION')?.passed,
    ).toBe(false);
    expect(result.validation.status).toBe(ChallengeValidationStatus.FAILED);
  });

  it('requires a reference solution for the REFERENCE judge method', async () => {
    prisma.challenge.findUnique.mockResolvedValue(
      challengeRow({ judgeMethod: JudgeMethod.REFERENCE, referenceSolutionCode: null }),
    );

    const result = await service.validate('challenge-1');

    expect(
      result.validation.checks.find((c) => c.name === 'JUDGE_CONFIGURATION')?.passed,
    ).toBe(false);
  });

  it('accepts EXACT and DEEP_EQUAL without any extra judge code', async () => {
    for (const judgeMethod of [JudgeMethod.EXACT, JudgeMethod.DEEP_EQUAL]) {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({ judgeMethod, referenceSolutionCode: null }),
      );
      const result = await service.validate('challenge-1');
      expect(
        result.validation.checks.find((c) => c.name === 'JUDGE_CONFIGURATION')?.passed,
      ).toBe(true);
    }
  });

  it('fails when the publishing floor on test counts is not met', async () => {
    prisma.challenge.findUnique.mockResolvedValue(
      challengeRow({
        testCases: [
          { id: 't1', order: 0, isHidden: false, input: { nums: [1], target: 1 }, expectedOutput: [] },
        ],
      }),
    );

    const result = await service.validate('challenge-1');

    expect(result.validation.checks.find((c) => c.name === 'TEST_COUNTS')?.passed).toBe(
      false,
    );
    expect(result.validation.status).toBe(ChallengeValidationStatus.FAILED);
  });

  it('sends generator seeds only when a generator is configured', async () => {
    prisma.challenge.findUnique.mockResolvedValue(challengeRow());
    await service.validate('challenge-1');
    expect(runner.trySubmit.mock.calls[0][0].generatorSeeds).toBeUndefined();

    runner.trySubmit.mockClear();
    prisma.challenge.findUnique.mockResolvedValue(
      challengeRow({ testGeneratorCode: 'function generate(seed) { return {}; }' }),
    );
    await service.validate('challenge-1');
    expect(runner.trySubmit.mock.calls[0][0].generatorSeeds).toEqual([101, 202, 303]);
  });

  it('does not record a verdict when the runner is unreachable', async () => {
    prisma.challenge.findUnique.mockResolvedValue(challengeRow());
    runner.trySubmit.mockResolvedValue({ ok: false, error: 'ECONNREFUSED' });

    await expect(service.validate('challenge-1')).rejects.toBeInstanceOf(
      ChallengeValidationFailedException,
    );
    // "the runner is down" must not be recorded as "the challenge is wrong".
    expect(prisma.challenge.update).not.toHaveBeenCalled();
  });
});
