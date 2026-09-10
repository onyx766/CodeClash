import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeStatus, Difficulty, JudgeMethod } from '@prisma/client';
import { ChallengesService } from './challenges.service';
import { PrismaService } from '../../database/prisma.service';
import { ChallengeNotFoundException } from '../../common/exceptions/app.exception';

const SECRETS = {
  referenceSolutionCode: 'function solve(){ return [0,1]; } // THE ANSWER',
  customCheckerCode: 'function check(){ return { passed: true }; }',
  testGeneratorCode: 'function generate(seed){ return { nums: [seed] }; }',
};

function publishedRow() {
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
    ...SECRETS,
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    outputLimitKb: 64,
    timeLimitSeconds: 300,
    status: ChallengeStatus.PUBLISHED,
    creationMode: 'MANUAL',
    validationStatus: 'PASSED',
    validatedAt: new Date(),
    validationChecks: [{ name: 'HIDDEN_TESTS', passed: true }],
    validationFingerprint: 'abc123',
    createdById: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
    archivedAt: null,
    tags: [{ id: 'tag-1', slug: 'array', label: 'array', createdAt: new Date() }],
    // The query filters isHidden: false, so a correct implementation only ever
    // sees public rows here. A hidden row is planted anyway to prove the
    // serializer would not leak one even if the filter were removed.
    testCases: [
      { id: 't1', order: 0, isHidden: false, input: { nums: [2, 7], target: 9 }, expectedOutput: [0, 1] },
      { id: 't9', order: 9, isHidden: true, input: { nums: [99, 1], target: 100 }, expectedOutput: [0, 1] },
    ],
  };
}

describe('ChallengesService (player-facing)', () => {
  let service: ChallengesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      challenge: { findMany: jest.fn(), findFirst: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChallengesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ChallengesService);
  });

  it('only ever queries PUBLISHED challenges', async () => {
    prisma.challenge.findMany.mockResolvedValue([]);
    await service.listPublished();
    expect(prisma.challenge.findMany.mock.calls[0][0].where.status).toBe(
      ChallengeStatus.PUBLISHED,
    );

    prisma.challenge.findFirst.mockResolvedValue(publishedRow());
    await service.findPublished('two-sum');
    expect(prisma.challenge.findFirst.mock.calls[0][0].where.status).toBe(
      ChallengeStatus.PUBLISHED,
    );
  });

  it('excludes hidden test cases at the query level', async () => {
    prisma.challenge.findFirst.mockResolvedValue(publishedRow());
    await service.findPublished('two-sum');
    expect(
      prisma.challenge.findFirst.mock.calls[0][0].include.testCases.where,
    ).toEqual({ isHidden: false });
  });

  it('never returns hidden tests, judge code or validation data', async () => {
    prisma.challenge.findFirst.mockResolvedValue(publishedRow());

    const { challenge } = await service.findPublished('two-sum');
    const serialized = JSON.stringify(challenge);

    expect(challenge.publicTests).toHaveLength(1);
    expect(challenge.publicTests[0].input).toEqual({ nums: [2, 7], target: 9 });

    for (const secret of Object.values(SECRETS)) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain('THE ANSWER');
    // The planted hidden test's data must not appear anywhere in the payload.
    expect(serialized).not.toContain('99');
    expect(challenge).not.toHaveProperty('validation');
    expect(challenge).not.toHaveProperty('validationFingerprint');
    expect(challenge).not.toHaveProperty('testCases');
    expect(challenge).not.toHaveProperty('judge');
  });

  it('exposes the function contract players need without the answer', async () => {
    prisma.challenge.findFirst.mockResolvedValue(publishedRow());
    const { challenge } = await service.findPublished('two-sum');

    expect(challenge.function).toEqual({
      name: 'solve',
      parameters: [
        { name: 'nums', type: 'number[]' },
        { name: 'target', type: 'number' },
      ],
      returnType: 'number[]',
      starterCode: 'function solve(nums, target) {}',
    });
  });

  it('reports a draft or archived challenge as not found', async () => {
    // findFirst returns nothing because the status filter excluded it.
    prisma.challenge.findFirst.mockResolvedValue(null);
    await expect(service.findPublished('a-draft')).rejects.toBeInstanceOf(
      ChallengeNotFoundException,
    );
  });

  it('omits starter code and sample tests from the list view', async () => {
    prisma.challenge.findMany.mockResolvedValue([publishedRow()]);
    const { challenges } = await service.listPublished();

    expect(challenges[0].publicTestCount).toBe(1);
    expect(challenges[0]).not.toHaveProperty('publicTests');
    expect(challenges[0].function).not.toHaveProperty('starterCode');
  });
});
