import { Test, TestingModule } from '@nestjs/testing';
import {
  ChallengeCreationMode,
  ChallengeStatus,
  ChallengeValidationStatus,
  Difficulty,
  JudgeMethod,
  Prisma,
} from '@prisma/client';
import { AdminChallengesService } from './admin-challenges.service';
import { PrismaService } from '../../database/prisma.service';
import {
  ChallengeAlreadyPublishedException,
  ChallengeInUseException,
  ChallengeLockedException,
  ChallengeNotFoundException,
  ChallengeNotValidatedException,
  ChallengeSlugExistsException,
  InvalidChallengeException,
  InvalidFunctionContractException,
  InvalidTestCaseException,
} from '../../common/exceptions/app.exception';
import type { UpsertChallengeDto } from './dto/upsert-challenge.dto';

const CONTRACT = {
  functionName: 'solve',
  parameters: [
    { name: 'nums', type: 'number[]' },
    { name: 'target', type: 'number' },
  ],
  returnType: 'number[]',
  starterCode: 'function solve(nums, target) {\n}\n',
};

function challengeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge-1',
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Return the indices of the two numbers adding to target.',
    difficulty: Difficulty.EASY,
    problemType: 'FUNCTION',
    functionName: 'solve',
    parameters: CONTRACT.parameters,
    returnType: 'number[]',
    starterCode: CONTRACT.starterCode,
    judgeMethod: JudgeMethod.DEEP_EQUAL,
    customCheckerCode: null,
    referenceSolutionCode: null,
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
    validationFingerprint: null as string | null,
    createdById: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    archivedAt: null,
    tags: [],
    testCases: [
      { id: 't1', challengeId: 'challenge-1', order: 0, isHidden: false, input: { nums: [2, 7], target: 9 }, expectedOutput: [0, 1], createdAt: new Date(), updatedAt: new Date() },
      { id: 't2', challengeId: 'challenge-1', order: 1, isHidden: true, input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], createdAt: new Date(), updatedAt: new Date() },
      { id: 't3', challengeId: 'challenge-1', order: 2, isHidden: true, input: { nums: [1, 2], target: 9 }, expectedOutput: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 't4', challengeId: 'challenge-1', order: 3, isHidden: true, input: { nums: [], target: 0 }, expectedOutput: [], createdAt: new Date(), updatedAt: new Date() },
    ],
    ...overrides,
  };
}

describe('AdminChallengesService', () => {
  let service: AdminChallengesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      challenge: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      challengeTestCase: { deleteMany: jest.fn(), create: jest.fn() },
      challengeTag: { upsert: jest.fn() },
      matchChallenge: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminChallengesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AdminChallengesService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('always creates a DRAFT with NOT_CHECKED validation, whatever the mode', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);
      prisma.challenge.create.mockResolvedValue(challengeRow());

      await service.create(
        'admin-1',
        { title: 'Two Sum', description: 'x'.repeat(20), functionContract: CONTRACT } as UpsertChallengeDto,
        ChallengeCreationMode.AI,
      );

      const data = prisma.challenge.create.mock.calls[0][0].data;
      expect(data.status).toBe(ChallengeStatus.DRAFT);
      expect(data.validationStatus).toBe(ChallengeValidationStatus.NOT_CHECKED);
      expect(data.creationMode).toBe(ChallengeCreationMode.AI);
      expect(data.publishedAt).toBeUndefined();
      expect(data.createdById).toBe('admin-1');
    });

    it('stores the starter code and the declared contract', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);
      prisma.challenge.create.mockResolvedValue(challengeRow());

      await service.create('admin-1', {
        title: 'Two Sum',
        functionContract: CONTRACT,
      } as UpsertChallengeDto);

      const data = prisma.challenge.create.mock.calls[0][0].data;
      expect(data.starterCode).toBe(CONTRACT.starterCode);
      expect(data.functionName).toBe('solve');
      expect(data.parameters).toEqual(CONTRACT.parameters);
      expect(data.returnType).toBe('number[]');
    });

    it('generates starter code when none is supplied', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);
      prisma.challenge.create.mockResolvedValue(challengeRow());

      await service.create('admin-1', { title: 'Two Sum' } as UpsertChallengeDto);

      const data = prisma.challenge.create.mock.calls[0][0].data;
      expect(data.starterCode).toContain('function solve(');
    });

    it('requires a title', async () => {
      await expect(service.create('admin-1', {} as UpsertChallengeDto)).rejects.toBeInstanceOf(
        InvalidChallengeException,
      );
      expect(prisma.challenge.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid function name', async () => {
      await expect(
        service.create('admin-1', {
          title: 'Two Sum',
          functionContract: { ...CONTRACT, functionName: 'my fn' },
        } as UpsertChallengeDto),
      ).rejects.toBeInstanceOf(InvalidFunctionContractException);
    });

    it('rejects a dangerous parameter name', async () => {
      await expect(
        service.create('admin-1', {
          title: 'Two Sum',
          functionContract: {
            ...CONTRACT,
            parameters: [{ name: '__proto__', type: 'number' }],
          },
        } as UpsertChallengeDto),
      ).rejects.toBeInstanceOf(InvalidFunctionContractException);
    });

    it('derives a free slug from the title when the obvious one is taken', async () => {
      prisma.challenge.findUnique
        .mockResolvedValueOnce({ id: 'other' })
        .mockResolvedValueOnce(null);
      prisma.challenge.create.mockResolvedValue(challengeRow());

      await service.create('admin-1', { title: 'Two Sum' } as UpsertChallengeDto);

      expect(prisma.challenge.create.mock.calls[0][0].data.slug).toBe('two-sum-2');
    });

    it('rejects an explicitly supplied slug that is taken', async () => {
      prisma.challenge.findUnique.mockResolvedValue({ id: 'other' });

      await expect(
        service.create('admin-1', {
          title: 'Two Sum',
          slug: 'two-sum',
        } as UpsertChallengeDto),
      ).rejects.toBeInstanceOf(ChallengeSlugExistsException);
    });

    it('creates public and hidden test cases with a stable order', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);
      prisma.challenge.create.mockResolvedValue(challengeRow());

      await service.create('admin-1', {
        title: 'Two Sum',
        functionContract: CONTRACT,
        testCases: [
          { input: { nums: [2, 7], target: 9 }, expectedOutput: [0, 1], isHidden: false },
          { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], isHidden: true },
        ],
      } as UpsertChallengeDto);

      const created = prisma.challenge.create.mock.calls[0][0].data.testCases.create;
      expect(created).toHaveLength(2);
      expect(created[0]).toMatchObject({ isHidden: false, order: 0 });
      expect(created[1]).toMatchObject({ isHidden: true, order: 1 });
    });

    it('defaults a test case to hidden', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);
      prisma.challenge.create.mockResolvedValue(challengeRow());

      await service.create('admin-1', {
        title: 'Two Sum',
        functionContract: CONTRACT,
        testCases: [{ input: { nums: [1], target: 1 }, expectedOutput: [] }],
      } as UpsertChallengeDto);

      expect(
        prisma.challenge.create.mock.calls[0][0].data.testCases.create[0].isHidden,
      ).toBe(true);
    });

    it('rejects a test case whose input does not match the contract', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);

      await expect(
        service.create('admin-1', {
          title: 'Two Sum',
          functionContract: CONTRACT,
          testCases: [{ input: { nums: [1] }, expectedOutput: [] }],
        } as UpsertChallengeDto),
      ).rejects.toBeInstanceOf(InvalidTestCaseException);
    });

    it('rejects a test case carrying a prototype-pollution key', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);

      await expect(
        service.create('admin-1', {
          title: 'Two Sum',
          testCases: [{ input: JSON.parse('{"__proto__":{"x":1}}'), expectedOutput: 1 }],
        } as UpsertChallengeDto),
      ).rejects.toBeInstanceOf(InvalidTestCaseException);
    });

    it('stores a missing expectation as a database NULL, not JSON null', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);
      prisma.challenge.create.mockResolvedValue(challengeRow());

      await service.create('admin-1', {
        title: 'Two Sum',
        functionContract: CONTRACT,
        testCases: [{ input: { nums: [1], target: 1 } }],
      } as UpsertChallengeDto);

      expect(
        prisma.challenge.create.mock.calls[0][0].data.testCases.create[0].expectedOutput,
      ).toBe(Prisma.DbNull);
    });
  });

  // -------------------------------------------------------------------------
  // update / validation invalidation
  // -------------------------------------------------------------------------

  describe('update', () => {
    beforeEach(() => {
      prisma.challenge.findUniqueOrThrow.mockResolvedValue(challengeRow());
    });

    it('invalidates a passed validation when test cases change', async () => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({
          validationStatus: ChallengeValidationStatus.PASSED,
          validationFingerprint: 'abc',
        }),
      );

      await service.update('challenge-1', {
        testCases: [{ input: { nums: [9], target: 9 }, expectedOutput: [], isHidden: true }],
      } as UpsertChallengeDto);

      const data = prisma.challenge.update.mock.calls[0][0].data;
      expect(data.validationStatus).toBe(ChallengeValidationStatus.NOT_CHECKED);
      expect(data.validatedAt).toBeNull();
      expect(data.validationFingerprint).toBeNull();
    });

    it.each([
      ['judge method', { judgeMethod: JudgeMethod.EXACT }],
      // A changed contract (here: new starter code). Re-sending the identical
      // contract is not a change - see the published re-save test below.
      [
        'function contract',
        { functionContract: { ...CONTRACT, starterCode: 'function solve(nums, target) {\n  return [];\n}\n' } },
      ],
      ['reference solution', { referenceSolutionCode: 'function solve() {}' }],
      ['custom checker', { customCheckerCode: 'function check() {}' }],
      ['test generator', { testGeneratorCode: 'function generate() {}' }],
      ['time limit', { timeLimitMs: 3000 }],
      ['memory limit', { memoryLimitMb: 256 }],
      ['output limit', { outputLimitKb: 128 }],
    ])('invalidates a passed validation when the %s changes', async (_label, patch) => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({
          validationStatus: ChallengeValidationStatus.PASSED,
          validationFingerprint: 'abc',
        }),
      );

      await service.update('challenge-1', patch as UpsertChallengeDto);

      expect(prisma.challenge.update.mock.calls[0][0].data.validationStatus).toBe(
        ChallengeValidationStatus.NOT_CHECKED,
      );
    });

    it('keeps a passed validation for a presentational edit', async () => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({
          validationStatus: ChallengeValidationStatus.PASSED,
          validationFingerprint: 'abc',
        }),
      );

      await service.update('challenge-1', {
        description: 'A clearer description of the same problem.',
        tags: [],
      } as UpsertChallengeDto);

      expect(
        prisma.challenge.update.mock.calls[0][0].data.validationStatus,
      ).toBeUndefined();
    });

    it('refuses to change judging on a published challenge', async () => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({ status: ChallengeStatus.PUBLISHED }),
      );

      await expect(
        service.update('challenge-1', {
          testCases: [{ input: { nums: [1], target: 1 }, expectedOutput: [] }],
        } as UpsertChallengeDto),
      ).rejects.toBeInstanceOf(ChallengeLockedException);
      expect(prisma.challenge.update).not.toHaveBeenCalled();
    });

    it('still allows a presentational edit on a published challenge', async () => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({ status: ChallengeStatus.PUBLISHED }),
      );

      await service.update('challenge-1', {
        description: 'Typo fixed in the problem statement.',
      } as UpsertChallengeDto);

      expect(prisma.challenge.update).toHaveBeenCalled();
    });

    it('accepts a full re-save of a published challenge when only presentation changed', async () => {
      const row = challengeRow({ status: ChallengeStatus.PUBLISHED });
      prisma.challenge.findUnique.mockResolvedValue(row);

      // What the console sends: the whole draft, judging fields unchanged.
      await service.update('challenge-1', {
        title: 'Two Sum (revised wording)',
        functionContract: CONTRACT,
        judgeMethod: row.judgeMethod,
        timeLimitMs: row.timeLimitMs,
        memoryLimitMb: row.memoryLimitMb,
        outputLimitKb: row.outputLimitKb,
        referenceSolutionCode: '',
        customCheckerCode: '',
        testGeneratorCode: '',
        testCases: row.testCases.map((t) => ({
          input: t.input,
          expectedOutput: t.expectedOutput,
          isHidden: t.isHidden,
        })),
      } as unknown as UpsertChallengeDto);

      const data = prisma.challenge.update.mock.calls[0][0].data;
      expect(data.title).toBe('Two Sum (revised wording)');
      expect(data.validationStatus).toBeUndefined();
      expect(data.timeLimitMs).toBeUndefined();
      expect(prisma.challengeTestCase.deleteMany).not.toHaveBeenCalled();
    });

    it('still refuses a real judging change sent alongside presentation edits', async () => {
      const row = challengeRow({ status: ChallengeStatus.PUBLISHED });
      prisma.challenge.findUnique.mockResolvedValue(row);

      await expect(
        service.update('challenge-1', {
          title: 'Two Sum',
          timeLimitMs: row.timeLimitMs + 1000,
        } as UpsertChallengeDto),
      ).rejects.toBeInstanceOf(ChallengeLockedException);
      expect(prisma.challenge.update).not.toHaveBeenCalled();
    });

    it('reports a missing challenge', async () => {
      prisma.challenge.findUnique.mockResolvedValue(null);
      await expect(
        service.update('nope', { title: 'x' } as UpsertChallengeDto),
      ).rejects.toBeInstanceOf(ChallengeNotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // publish
  // -------------------------------------------------------------------------

  describe('publish', () => {
    it('refuses to publish a challenge that was never validated', async () => {
      prisma.challenge.findUnique.mockResolvedValue(challengeRow());
      await expect(service.publish('challenge-1')).rejects.toBeInstanceOf(
        ChallengeNotValidatedException,
      );
      expect(prisma.challenge.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to publish a challenge whose validation FAILED', async () => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({ validationStatus: ChallengeValidationStatus.FAILED }),
      );
      await expect(service.publish('challenge-1')).rejects.toBeInstanceOf(
        ChallengeNotValidatedException,
      );
    });

    it('refuses to publish when the challenge changed after validation', async () => {
      // PASSED, but the recorded fingerprint belongs to an older revision -
      // exactly the "validate -> edit a hidden test -> publish" sequence.
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({
          validationStatus: ChallengeValidationStatus.PASSED,
          validationFingerprint: 'fingerprint-of-a-previous-revision',
        }),
      );

      await expect(service.publish('challenge-1')).rejects.toThrow(
        /changed after it was validated/,
      );
      expect(prisma.challenge.updateMany).not.toHaveBeenCalled();
    });

    it('publishes when validation passed and is still current', async () => {
      const row = challengeRow({ validationStatus: ChallengeValidationStatus.PASSED });
      row.validationFingerprint = service.fingerprint(row as never);
      prisma.challenge.findUnique.mockResolvedValue(row);
      prisma.challenge.updateMany.mockResolvedValue({ count: 1 });
      prisma.challenge.findUniqueOrThrow.mockResolvedValue({
        ...row,
        status: ChallengeStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      const result = await service.publish('challenge-1');

      expect(result.challenge.status).toBe(ChallengeStatus.PUBLISHED);
      const where = prisma.challenge.updateMany.mock.calls[0][0].where;
      // The write is conditional on the same state we checked, so a concurrent
      // edit between the read and the write cannot slip through.
      expect(where.validationStatus).toBe(ChallengeValidationStatus.PASSED);
      expect(where.validationFingerprint).toBe(row.validationFingerprint);
    });

    it('refuses to publish an already published challenge', async () => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({ status: ChallengeStatus.PUBLISHED }),
      );
      await expect(service.publish('challenge-1')).rejects.toBeInstanceOf(
        ChallengeAlreadyPublishedException,
      );
    });

    it('refuses to publish below the minimum test counts', async () => {
      const row = challengeRow({
        validationStatus: ChallengeValidationStatus.PASSED,
        testCases: [
          { id: 't1', order: 0, isHidden: false, input: { nums: [1], target: 1 }, expectedOutput: [] },
        ],
      });
      row.validationFingerprint = service.fingerprint(row as never);
      prisma.challenge.findUnique.mockResolvedValue(row);

      await expect(service.publish('challenge-1')).rejects.toBeInstanceOf(
        InvalidChallengeException,
      );
      expect(prisma.challenge.updateMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // archive / delete
  // -------------------------------------------------------------------------

  describe('archive and delete', () => {
    it('archives a published challenge', async () => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({ status: ChallengeStatus.PUBLISHED }),
      );
      prisma.challenge.update.mockResolvedValue(
        challengeRow({ status: ChallengeStatus.ARCHIVED, archivedAt: new Date() }),
      );

      const result = await service.archive('challenge-1');

      expect(result.challenge.status).toBe(ChallengeStatus.ARCHIVED);
      expect(prisma.challenge.update.mock.calls[0][0].data.status).toBe(
        ChallengeStatus.ARCHIVED,
      );
    });

    it('deletes an unused draft', async () => {
      prisma.challenge.findUnique.mockResolvedValue(challengeRow());
      prisma.matchChallenge.count.mockResolvedValue(0);

      await expect(service.remove('challenge-1')).resolves.toEqual({ success: true });
      expect(prisma.challenge.delete).toHaveBeenCalled();
    });

    it('refuses to delete a challenge that has been played', async () => {
      prisma.challenge.findUnique.mockResolvedValue(challengeRow());
      prisma.matchChallenge.count.mockResolvedValue(4);

      await expect(service.remove('challenge-1')).rejects.toBeInstanceOf(
        ChallengeInUseException,
      );
      expect(prisma.challenge.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete a published challenge even before it has been played', async () => {
      prisma.challenge.findUnique.mockResolvedValue(
        challengeRow({ status: ChallengeStatus.PUBLISHED }),
      );
      prisma.matchChallenge.count.mockResolvedValue(0);

      await expect(service.remove('challenge-1')).rejects.toBeInstanceOf(
        ChallengeInUseException,
      );
    });
  });
});

describe('AdminChallengesService.stats', () => {
  function serviceWith(
    byStatus: Array<{ status: ChallengeStatus; _count: { _all: number } }>,
    validationPassed: number,
  ) {
    const challenge = {
      groupBy: jest.fn().mockResolvedValue(byStatus),
      count: jest.fn().mockResolvedValue(validationPassed),
      findMany: jest.fn(),
    };
    const service = new AdminChallengesService({ challenge } as never);
    return { service, challenge };
  }

  it('counts every challenge in the database, past the 200-row list page', async () => {
    const { service, challenge } = serviceWith(
      [
        { status: ChallengeStatus.DRAFT, _count: { _all: 250 } },
        { status: ChallengeStatus.PUBLISHED, _count: { _all: 17 } },
        { status: ChallengeStatus.ARCHIVED, _count: { _all: 3 } },
      ],
      16,
    );

    await expect(service.stats()).resolves.toEqual({
      success: true,
      stats: {
        total: 270,
        drafts: 250,
        published: 17,
        archived: 3,
        validationPassed: 16,
      },
    });
    expect(challenge.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
    // Passed validation whatever the status - drafts included.
    expect(challenge.count).toHaveBeenCalledWith({
      where: { validationStatus: ChallengeValidationStatus.PASSED },
    });
    expect(challenge.findMany).not.toHaveBeenCalled();
  });

  it('reports zero for a status nobody has', async () => {
    const { service } = serviceWith(
      [{ status: ChallengeStatus.DRAFT, _count: { _all: 2 } }],
      0,
    );

    await expect(service.stats()).resolves.toEqual({
      success: true,
      stats: {
        total: 2,
        drafts: 2,
        published: 0,
        archived: 0,
        validationPassed: 0,
      },
    });
  });
});
