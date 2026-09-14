import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChallengeProblemType,
  ChallengeStatus,
  ChallengeValidationStatus,
  Difficulty,
  Prisma,
} from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { InsufficientBattleChallengesException } from '../../common/exceptions/app.exception';
import { BattleConfig, DIFFICULTY_ORDER, loadBattleConfig } from './battle.config';

export interface SelectableChallenge {
  id: string;
  difficulty: Difficulty;
}

/** Returns an integer in [0, max). */
export type RandomIntFn = (max: number) => number;

const rank = (d: Difficulty) => DIFFICULTY_ORDER.indexOf(d);

/**
 * Other difficulties ordered by closeness to `wanted`; a tie goes to the
 * easier one. MEDIUM -> EASY, HARD, EXPERT. HARD -> MEDIUM, EXPERT, EASY.
 */
export function nearestDifficulties(wanted: Difficulty): Difficulty[] {
  return DIFFICULTY_ORDER.filter((d) => d !== wanted).sort(
    (a, b) =>
      Math.abs(rank(a) - rank(wanted)) - Math.abs(rank(b) - rank(wanted)) ||
      rank(a) - rank(b),
  );
}

function shuffle<T>(items: T[], random: RandomIntFn): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks exactly `count` distinct challenges.
 *
 *   1. Each difficulty's preferred slots are filled from its own shuffled pool.
 *   2. A slot its pool could not fill is filled from the nearest difficulty
 *      that still has challenges (see nearestDifficulties).
 *   3. Slots beyond the preferred distribution are filled from everything left.
 *
 * The result is ordered easiest-first; that order becomes the positions.
 * Throws rather than ever returning fewer than `count` challenges.
 */
export function pickBattleChallenges<T extends SelectableChallenge>(
  pool: T[],
  count: number,
  distribution: Record<Difficulty, number>,
  random: RandomIntFn,
): T[] {
  const unique = [...new Map(pool.map((c) => [c.id, c])).values()];
  if (unique.length < count) throw new InsufficientBattleChallengesException();

  const pools = new Map<Difficulty, T[]>(
    DIFFICULTY_ORDER.map((d) => [
      d,
      shuffle(
        unique.filter((c) => c.difficulty === d),
        random,
      ),
    ]),
  );
  const picked: T[] = [];
  const take = (d: Difficulty) => {
    const next = pools.get(d)!.shift();
    if (next) picked.push(next);
    return !!next;
  };

  const shortfall: Difficulty[] = [];
  for (const d of DIFFICULTY_ORDER) {
    for (let i = 0; i < distribution[d]; i++) {
      if (!take(d)) shortfall.push(d);
    }
  }
  for (const wanted of shortfall) {
    nearestDifficulties(wanted).some((d) => take(d));
  }

  const remaining = shuffle(
    DIFFICULTY_ORDER.flatMap((d) => pools.get(d)!),
    random,
  );
  picked.push(...remaining.slice(0, count - picked.length));

  if (picked.length !== count) throw new InsufficientBattleChallengesException();

  return picked
    .map((c, index) => ({ c, index }))
    .sort((a, b) => rank(a.c.difficulty) - rank(b.c.difficulty) || a.index - b.index)
    .map(({ c }) => c);
}

export interface BattleEligibilityInput {
  status: ChallengeStatus;
  archivedAt: Date | null;
  problemType: ChallengeProblemType;
  validationStatus: ChallengeValidationStatus;
  hiddenTestCount: number;
}

/**
 * Why a challenge is not in the battle pool - empty when it is. The per-row
 * mirror of MatchSelectionService.eligibleChallengeFilter (keep the two in
 * step; a spec checks they agree), used by the admin console.
 */
export function battleEligibilityProblems(
  challenge: BattleEligibilityInput,
  requireValidated: boolean,
): string[] {
  const problems: string[] = [];
  if (challenge.status === ChallengeStatus.DRAFT) problems.push('Not published yet.');
  if (challenge.status === ChallengeStatus.ARCHIVED || challenge.archivedAt) {
    problems.push('Archived.');
  }
  if (challenge.problemType !== ChallengeProblemType.FUNCTION) {
    problems.push('Only FUNCTION problems can be judged in battles.');
  }
  if (challenge.hiddenTestCount < 1) problems.push('Needs at least one hidden test.');
  if (requireValidated && challenge.validationStatus !== ChallengeValidationStatus.PASSED) {
    problems.push(
      challenge.validationStatus === ChallengeValidationStatus.FAILED
        ? 'Validation failed.'
        : 'Not validated yet.',
    );
  }
  return problems;
}

/**
 * Chooses a match's challenges. Called exactly once per match, while it is
 * being started; the result is persisted as MatchChallenge rows and every
 * later read uses those rows, so both players always see the same set.
 *
 * The client never chooses or influences the set - no endpoint accepts
 * challenge ids.
 */
@Injectable()
export class MatchSelectionService {
  private readonly battle: BattleConfig;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.battle = loadBattleConfig(config);
  }

  get challengeCount(): number {
    return this.battle.challengeCount;
  }

  /**
   * Playable in a battle: published, not archived, a FUNCTION problem (the
   * only kind the JavaScript runner judges), with at least one hidden test so
   * a submission is judged on more than the samples the player can see, and -
   * unless disabled for local development - a passing validation run.
   */
  eligibleChallengeFilter(): Prisma.ChallengeWhereInput {
    return {
      status: ChallengeStatus.PUBLISHED,
      archivedAt: null,
      problemType: ChallengeProblemType.FUNCTION,
      testCases: { some: { isHidden: true } },
      ...(this.battle.requireValidatedChallenges
        ? { validationStatus: ChallengeValidationStatus.PASSED }
        : {}),
    };
  }

  async selectChallenges(random: RandomIntFn = randomInt): Promise<SelectableChallenge[]> {
    const pool = await this.prisma.challenge.findMany({
      where: this.eligibleChallengeFilter(),
      select: { id: true, difficulty: true },
    });
    return pickBattleChallenges(
      pool,
      this.battle.challengeCount,
      this.battle.distribution,
      random,
    );
  }
}
