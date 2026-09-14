import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChallengeStatus, ChallengeValidationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import { ChallengeValidationFailedException } from '../../common/exceptions/app.exception';
import { BattleConfig, DIFFICULTY_ORDER, loadBattleConfig } from '../matches/battle.config';
import { battleEligibilityProblems } from '../matches/match-selection.service';
import { ChallengeValidationService } from './challenge-validation.service';

/** Upper bound for one batch; each validation is a full runner job. */
const BATCH_LIMIT = 50;

export type BatchOutcome = 'PASSED' | 'FAILED' | 'ERROR' | 'SKIPPED';

/**
 * Admin view of the battle pool: which challenges a match can draw from, why
 * the others cannot be used, and whether the code runner that validates them
 * is up. Eligibility uses the same rule as match selection
 * (battleEligibilityProblems / eligibleChallengeFilter).
 */
@Injectable()
export class ChallengeBattlePoolService {
  private readonly logger = new Logger(ChallengeBattlePoolService.name);
  private readonly battle: BattleConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: JudgeRunnerClient,
    private readonly redis: RedisService,
    private readonly validation: ChallengeValidationService,
    config: ConfigService,
  ) {
    this.battle = loadBattleConfig(config);
  }

  async overview() {
    const rows = await this.prisma.challenge.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        difficulty: true,
        status: true,
        archivedAt: true,
        problemType: true,
        validationStatus: true,
        validatedAt: true,
        testCases: { where: { isHidden: true }, select: { id: true } },
      },
      orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
      take: 500,
    });

    const challenges = rows.map(({ testCases, archivedAt, problemType, ...row }) => {
      const problems = battleEligibilityProblems(
        {
          status: row.status,
          archivedAt,
          problemType,
          validationStatus: row.validationStatus,
          hiddenTestCount: testCases.length,
        },
        this.battle.requireValidatedChallenges,
      );
      return { ...row, hiddenTestCount: testCases.length, eligible: problems.length === 0, problems };
    });

    const eligible = challenges.filter((c) => c.eligible);
    return {
      success: true,
      pool: {
        requireValidated: this.battle.requireValidatedChallenges,
        challengeCount: this.battle.challengeCount,
        distribution: this.battle.distribution,
        durationMinutes: Math.round(this.battle.durationMs / 60_000),
        eligibleCount: eligible.length,
        eligibleByDifficulty: Object.fromEntries(
          DIFFICULTY_ORDER.map((d) => [d, eligible.filter((c) => c.difficulty === d).length]),
        ),
        // pickBattleChallenges fills gaps from neighbouring difficulties, so
        // the count is all that decides whether a match can start.
        canStartMatch: eligible.length >= this.battle.challengeCount,
        needsValidationCount: challenges.filter(
          (c) =>
            c.status === ChallengeStatus.PUBLISHED &&
            c.validationStatus !== ChallengeValidationStatus.PASSED,
        ).length,
        runner: await this.runnerStatus(),
        challenges,
      },
    };
  }

  /**
   * Validates every published challenge that has not passed yet, one at a
   * time. If the runner turns out to be unreachable the rest are skipped
   * rather than each waiting on the same failure.
   */
  async validatePublished() {
    const targets = await this.prisma.challenge.findMany({
      where: {
        status: ChallengeStatus.PUBLISHED,
        validationStatus: { not: ChallengeValidationStatus.PASSED },
      },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
      take: BATCH_LIMIT,
    });

    const results: { id: string; title: string; outcome: BatchOutcome; message: string | null }[] = [];
    let runnerDown: string | null = null;

    for (const target of targets) {
      if (runnerDown) {
        results.push({ ...target, outcome: 'SKIPPED', message: 'Skipped - the code runner is unreachable.' });
        continue;
      }
      try {
        const { validation } = await this.validation.validate(target.id);
        const failing = validation.checks
          .filter((check) => !check.passed && check.name !== 'READY_TO_PUBLISH')
          .map((check) => check.message || check.name);
        results.push({
          ...target,
          outcome: validation.status === ChallengeValidationStatus.PASSED ? 'PASSED' : 'FAILED',
          message: failing.length ? failing.slice(0, 2).join(' ') : null,
        });
      } catch (err) {
        if (err instanceof ChallengeValidationFailedException) runnerDown = err.message;
        else this.logger.error(`Validating ${target.id} failed`, err instanceof Error ? err.stack : err);
        results.push({
          ...target,
          outcome: 'ERROR',
          message: err instanceof Error ? err.message : 'Validation could not run.',
        });
      }
    }

    const summary: Record<BatchOutcome, number> = { PASSED: 0, FAILED: 0, ERROR: 0, SKIPPED: 0 };
    for (const result of results) summary[result.outcome]++;
    return { success: true, results, summary };
  }

  private async runnerStatus() {
    const probe = await this.runner.probe();
    let workers: number | null = null;
    try {
      workers = (await this.redis.getClient().keys('runner:worker:*')).length;
    } catch {
      workers = null;
    }
    return { ...probe, workers };
  }
}
