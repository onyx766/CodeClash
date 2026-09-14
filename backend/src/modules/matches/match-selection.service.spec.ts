import { ConfigService } from '@nestjs/config';
import { Difficulty } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InsufficientBattleChallengesException } from '../../common/exceptions/app.exception';
import { loadBattleConfig } from './battle.config';
import {
  MatchSelectionService,
  SelectableChallenge,
  nearestDifficulties,
  pickBattleChallenges,
} from './match-selection.service';

const DEFAULT_DISTRIBUTION: Record<Difficulty, number> = { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 };
const random = (max: number) => Math.floor(Math.random() * max);

function pool(counts: Partial<Record<Difficulty, number>>): SelectableChallenge[] {
  return Object.entries(counts).flatMap(([difficulty, n]) =>
    Array.from({ length: n ?? 0 }, (_, i) => ({ id: `${difficulty}-${i}`, difficulty: difficulty as Difficulty })),
  );
}

function tally(picks: SelectableChallenge[]) {
  return picks.reduce<Record<string, number>>((acc, c) => {
    acc[c.difficulty] = (acc[c.difficulty] ?? 0) + 1;
    return acc;
  }, {});
}

/** Deterministic PRNG (mulberry32) so a seed reproduces a selection. */
function seeded(seed: number) {
  let a = seed;
  return (max: number) => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const config = (values: Record<string, unknown> = {}) =>
  ({ get: jest.fn((key: string) => values[key]) }) as unknown as ConfigService;

describe('pickBattleChallenges', () => {
  it('picks 2 EASY, 2 MEDIUM, 1 HARD - distinct, easiest first - every time', () => {
    const rich = pool({ EASY: 6, MEDIUM: 6, HARD: 4, EXPERT: 3 });
    for (let i = 0; i < 50; i++) {
      const picks = pickBattleChallenges(rich, 5, DEFAULT_DISTRIBUTION, random);
      expect(tally(picks)).toEqual({ EASY: 2, MEDIUM: 2, HARD: 1 });
      expect(new Set(picks.map((c) => c.id)).size).toBe(5);
      expect(picks.map((c) => c.difficulty)).toEqual(['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'HARD']);
    }
  });

  it('fills a missing HARD slot from MEDIUM, the nearest pool', () => {
    const picks = pickBattleChallenges(pool({ EASY: 3, MEDIUM: 3 }), 5, DEFAULT_DISTRIBUTION, random);
    expect(tally(picks)).toEqual({ EASY: 2, MEDIUM: 3 });
  });

  it('fills a missing MEDIUM slot from EASY before HARD', () => {
    const picks = pickBattleChallenges(pool({ EASY: 5, MEDIUM: 1, HARD: 1 }), 5, DEFAULT_DISTRIBUTION, random);
    expect(tally(picks)).toEqual({ EASY: 3, MEDIUM: 1, HARD: 1 });
  });

  it('still returns five from a single-difficulty pool', () => {
    const picks = pickBattleChallenges(pool({ EASY: 5 }), 5, DEFAULT_DISTRIBUTION, random);
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((c) => c.id)).size).toBe(5);
  });

  it('fills slots beyond the preferred distribution from anything left', () => {
    const picks = pickBattleChallenges(
      pool({ EASY: 3, MEDIUM: 3, HARD: 3 }),
      5,
      { EASY: 1, MEDIUM: 1, HARD: 1, EXPERT: 0 },
      random,
    );
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((c) => c.id)).size).toBe(5);
  });

  it('refuses rather than returning fewer than five, and does not count duplicates', () => {
    expect(() => pickBattleChallenges(pool({ EASY: 2, HARD: 2 }), 5, DEFAULT_DISTRIBUTION, random)).toThrow(
      InsufficientBattleChallengesException,
    );
    const duplicated = [...pool({ EASY: 4 }), { id: 'EASY-0', difficulty: Difficulty.EASY }];
    expect(() => pickBattleChallenges(duplicated, 5, DEFAULT_DISTRIBUTION, random)).toThrow(
      InsufficientBattleChallengesException,
    );
  });

  it('is driven only by the injected randomness', () => {
    const rich = pool({ EASY: 10, MEDIUM: 10, HARD: 10 });
    const a = pickBattleChallenges(rich, 5, DEFAULT_DISTRIBUTION, seeded(42)).map((c) => c.id);
    const b = pickBattleChallenges(rich, 5, DEFAULT_DISTRIBUTION, seeded(42)).map((c) => c.id);
    const c = pickBattleChallenges(rich, 5, DEFAULT_DISTRIBUTION, seeded(7)).map((c) => c.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe('nearestDifficulties', () => {
  it('orders by distance, easier first on a tie', () => {
    expect(nearestDifficulties(Difficulty.MEDIUM)).toEqual(['EASY', 'HARD', 'EXPERT']);
    expect(nearestDifficulties(Difficulty.HARD)).toEqual(['MEDIUM', 'EXPERT', 'EASY']);
    expect(nearestDifficulties(Difficulty.EASY)).toEqual(['MEDIUM', 'HARD', 'EXPERT']);
  });
});

describe('loadBattleConfig', () => {
  it('defaults to 5 challenges (2/2/1), 30 minutes, validated challenges only', () => {
    expect(loadBattleConfig(config())).toEqual({
      challengeCount: 5,
      distribution: { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 },
      durationMs: 30 * 60_000,
      requireValidatedChallenges: true,
      judgeGraceMs: 60_000,
    });
  });

  it('reads overrides', () => {
    const loaded = loadBattleConfig(
      config({ MATCH_EASY_COUNT: 3, MATCH_MEDIUM_COUNT: 1, MATCH_REQUIRE_VALIDATED_CHALLENGES: false }),
    );
    expect(loaded.distribution).toMatchObject({ EASY: 3, MEDIUM: 1, HARD: 1 });
    expect(loaded.requireValidatedChallenges).toBe(false);
  });

  it('refuses a distribution larger than the challenge count', () => {
    expect(() => loadBattleConfig(config({ MATCH_EASY_COUNT: 5 }))).toThrow(/more than MATCH_CHALLENGE_COUNT/);
  });
});

describe('MatchSelectionService', () => {
  function service(values: Record<string, unknown> = {}) {
    const prisma = { challenge: { findMany: jest.fn().mockResolvedValue(pool({ EASY: 2, MEDIUM: 2, HARD: 1 })) } };
    return { prisma, selection: new MatchSelectionService(prisma as unknown as PrismaService, config(values)) };
  }

  it('queries only published, unarchived, FUNCTION challenges with hidden tests and a passing validation', async () => {
    const { prisma, selection } = service();

    const picks = await selection.selectChallenges();

    expect(picks).toHaveLength(5);
    expect(prisma.challenge.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PUBLISHED',
        archivedAt: null,
        problemType: 'FUNCTION',
        testCases: { some: { isHidden: true } },
        validationStatus: 'PASSED',
      },
      select: { id: true, difficulty: true },
    });
  });

  it('drops the validation requirement only when configured to', () => {
    const { selection } = service({ MATCH_REQUIRE_VALIDATED_CHALLENGES: false });
    expect(selection.eligibleChallengeFilter()).not.toHaveProperty('validationStatus');
  });
});
