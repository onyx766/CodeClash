import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import { ChallengeValidationFailedException } from '../../common/exceptions/app.exception';
import { MatchSelectionService } from '../matches/match-selection.service';
import { FakePrisma, seedChallenge, seedIneligible, seedPool } from '../matches/battle.test-utils';
import { ChallengeBattlePoolService } from './battle-pool.service';
import { ChallengeValidationService } from './challenge-validation.service';

function build(config: Record<string, unknown> = {}, runnerReachable = true) {
  const prisma = new FakePrisma();
  const configService = { get: jest.fn((key: string) => config[key]) } as unknown as ConfigService;
  const runner = {
    probe: jest.fn(async () => ({ reachable: runnerReachable, message: runnerReachable ? 'up' : 'down' })),
  };
  const redis = { getClient: () => ({ keys: jest.fn(async () => ['runner:worker:a']) }) };
  const validation = {
    validate: jest.fn(async (id: string) => {
      const row = prisma.rows('challenge').find((c) => c.id === id)!;
      row.validationStatus = row.title.includes('broken') ? 'FAILED' : 'PASSED';
      return {
        validation: {
          status: row.validationStatus,
          validatedAt: new Date(),
          checks: row.validationStatus === 'PASSED'
            ? [{ name: 'READY_TO_PUBLISH', passed: true }]
            : [{ name: 'HIDDEN_TESTS', passed: false, message: 'Reference solution disagrees with test #3.' }],
        },
      };
    }),
  };
  const service = new ChallengeBattlePoolService(
    prisma as unknown as PrismaService,
    runner as unknown as JudgeRunnerClient,
    redis as unknown as RedisService,
    validation as unknown as ChallengeValidationService,
    configService,
  );
  const selection = new MatchSelectionService(prisma as unknown as PrismaService, configService);
  return { prisma, service, validation, runner, selection };
}

describe('ChallengeBattlePoolService', () => {
  it('reports exactly the challenges match selection would draw from', async () => {
    const { prisma, service, selection } = build();
    seedPool(prisma, { EASY: 2, MEDIUM: 1 });
    seedIneligible(prisma);

    const { pool } = await service.overview();
    const selectable = await prisma.challenge.findMany({ where: selection.eligibleChallengeFilter(), select: { id: true } });

    expect(pool.challenges.filter((c) => c.eligible).map((c) => c.id).sort()).toEqual(
      selectable.map((c: { id: string }) => c.id).sort(),
    );
    for (const challenge of pool.challenges.filter((c) => !c.eligible)) {
      expect(challenge.problems.length).toBeGreaterThan(0);
    }
  });

  it('says why each excluded challenge is excluded', async () => {
    const { prisma, service } = build();
    seedIneligible(prisma);

    const { pool } = await service.overview();
    const problemsOf = (title: string) => pool.challenges.find((c) => c.title === title)!.problems;

    expect(problemsOf('DECOY draft')).toContain('Not published yet.');
    expect(problemsOf('DECOY archived')).toContain('Archived.');
    expect(problemsOf('DECOY unvalidated')).toEqual(['Not validated yet.']);
    expect(problemsOf('DECOY failed validation')).toEqual(['Validation failed.']);
    expect(problemsOf('DECOY stdio')).toContain('Only FUNCTION problems can be judged in battles.');
    expect(problemsOf('DECOY samples only')).toContain('Needs at least one hidden test.');
  });

  it('knows whether a match can start, and counts by difficulty', async () => {
    const { prisma, service } = build();
    seedPool(prisma, { EASY: 3, MEDIUM: 1 });
    expect((await service.overview()).pool).toMatchObject({
      canStartMatch: false,
      eligibleCount: 4,
      eligibleByDifficulty: { EASY: 3, MEDIUM: 1, HARD: 0, EXPERT: 0 },
    });

    seedPool(prisma, { HARD: 1 });
    expect((await service.overview()).pool.canStartMatch).toBe(true);
  });

  it('counts unvalidated challenges as eligible only when validation is not required', async () => {
    const { prisma, service } = build({ MATCH_REQUIRE_VALIDATED_CHALLENGES: false });
    for (let i = 0; i < 5; i++) seedChallenge(prisma, { validationStatus: 'NOT_CHECKED' });

    const { pool } = await service.overview();
    expect(pool).toMatchObject({ requireValidated: false, eligibleCount: 5, canStartMatch: true, needsValidationCount: 5 });
  });

  it('includes runner reachability and worker count', async () => {
    const { service } = build({}, false);
    expect((await service.overview()).pool.runner).toEqual({ reachable: false, message: 'down', workers: 1 });
  });

  describe('validatePublished', () => {
    it('validates only published challenges that have not passed', async () => {
      const { prisma, service, validation } = build();
      const pending = seedChallenge(prisma, { title: 'Pending', validationStatus: 'NOT_CHECKED' });
      const broken = seedChallenge(prisma, { title: 'A broken one', validationStatus: 'FAILED' });
      seedChallenge(prisma, { title: 'Already fine', validationStatus: 'PASSED' });
      seedChallenge(prisma, { title: 'Draft', status: 'DRAFT', validationStatus: 'NOT_CHECKED' });

      const result = await service.validatePublished();

      expect(validation.validate.mock.calls.map((c) => c[0]).sort()).toEqual([broken.id, pending.id].sort());
      expect(result.summary).toEqual({ PASSED: 1, FAILED: 1, ERROR: 0, SKIPPED: 0 });
      expect(result.results.find((r) => r.id === broken.id)).toMatchObject({
        outcome: 'FAILED',
        message: 'Reference solution disagrees with test #3.',
      });
    });

    it('stops calling the runner once it is found unreachable', async () => {
      const { prisma, service, validation } = build();
      for (let i = 0; i < 3; i++) seedChallenge(prisma, { title: `C${i}`, validationStatus: 'NOT_CHECKED' });
      validation.validate.mockRejectedValue(
        new ChallengeValidationFailedException('The code runner could not be reached.'),
      );

      const result = await service.validatePublished();

      expect(validation.validate).toHaveBeenCalledTimes(1);
      expect(result.summary).toEqual({ PASSED: 0, FAILED: 0, ERROR: 1, SKIPPED: 2 });
      expect(result.results[0].message).toBe('The code runner could not be reached.');
    });
  });
});
