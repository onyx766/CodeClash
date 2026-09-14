import { ConfigService } from '@nestjs/config';
import { Difficulty } from '@prisma/client';

/** Easiest first. Also the order positions are assigned in within a match. */
export const DIFFICULTY_ORDER: Difficulty[] = [
  Difficulty.EASY,
  Difficulty.MEDIUM,
  Difficulty.HARD,
  Difficulty.EXPERT,
];

export interface BattleConfig {
  /** Exactly this many challenges per match. */
  challengeCount: number;
  /**
   * Preferred slots per difficulty. Slots left over when these sum to less
   * than challengeCount are filled from any difficulty.
   */
  distribution: Record<Difficulty, number>;
  durationMs: number;
  /** Only challenges whose last validation run PASSED are eligible. */
  requireValidatedChallenges: boolean;
  /**
   * After expiresAt, how long timeout resolution waits for scored submissions
   * made before the deadline to finish judging.
   */
  judgeGraceMs: number;
}

function readNumber(config: ConfigService, key: string, fallback: number): number {
  const raw = config.get<unknown>(key);
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readBoolean(config: ConfigService, key: string, fallback: boolean): boolean {
  const raw = config.get<unknown>(key);
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'boolean') return raw;
  return String(raw).toLowerCase() === 'true';
}

export function loadBattleConfig(config: ConfigService): BattleConfig {
  const challengeCount = readNumber(config, 'MATCH_CHALLENGE_COUNT', 5);
  const distribution: Record<Difficulty, number> = {
    [Difficulty.EASY]: readNumber(config, 'MATCH_EASY_COUNT', 2),
    [Difficulty.MEDIUM]: readNumber(config, 'MATCH_MEDIUM_COUNT', 2),
    [Difficulty.HARD]: readNumber(config, 'MATCH_HARD_COUNT', 1),
    [Difficulty.EXPERT]: readNumber(config, 'MATCH_EXPERT_COUNT', 0),
  };

  const preferred = DIFFICULTY_ORDER.reduce((sum, d) => sum + distribution[d], 0);
  if (challengeCount < 1) {
    throw new Error('MATCH_CHALLENGE_COUNT must be at least 1.');
  }
  if (preferred > challengeCount) {
    throw new Error(
      `MATCH_*_COUNT values add up to ${preferred}, more than MATCH_CHALLENGE_COUNT (${challengeCount}).`,
    );
  }

  return {
    challengeCount,
    distribution,
    durationMs: readNumber(config, 'MATCH_DURATION_MINUTES', 30) * 60_000,
    requireValidatedChallenges: readBoolean(
      config,
      'MATCH_REQUIRE_VALIDATED_CHALLENGES',
      true,
    ),
    judgeGraceMs: readNumber(config, 'MATCH_JUDGE_GRACE_SECONDS', 60) * 1000,
  };
}
