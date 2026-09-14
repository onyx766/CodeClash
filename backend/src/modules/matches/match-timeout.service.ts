import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { MatchStatus, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BattleConfig, loadBattleConfig } from './battle.config';
import { MatchFinalizationService } from './match-finalization.service';

/** How often expired matches, stuck submissions and unrated matches are swept. */
export const MATCH_SWEEP_INTERVAL_MS = 2000;

/**
 * Longer than the runner client's own 180s ceiling, so a submission still in
 * QUEUED/RUNNING after this can only mean its request died with the process.
 */
export const STUCK_SUBMISSION_MS = 5 * 60_000;

const PENDING_SUBMISSION: SubmissionStatus[] = [
  SubmissionStatus.QUEUED,
  SubmissionStatus.RUNNING,
];

/**
 * The server-side clock of a battle. No client request is needed for a match
 * to end: once expiresAt passes, this resolves it (see
 * MatchFinalizationService.resolveTimeout for the tie-break).
 *
 * Scored submissions made before the deadline get up to MATCH_JUDGE_GRACE
 * to finish judging before the result is taken, so a player is not robbed of
 * a solve by runner queue latency. After the grace period they are ignored.
 *
 * Safe on every backend instance at once: resolution happens under the Match
 * row lock with a conditional status update, so each match ends exactly once.
 */
@Injectable()
export class MatchTimeoutService {
  private readonly logger = new Logger(MatchTimeoutService.name);
  private readonly battle: BattleConfig;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly finalization: MatchFinalizationService,
    config: ConfigService,
  ) {
    this.battle = loadBattleConfig(config);
  }

  @Interval(MATCH_SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.resolveExpiredMatches();
      await this.failStuckSubmissions();
      await this.retryUnratedMatches();
    } catch (err) {
      this.logger.error('Match sweep failed', err instanceof Error ? err.stack : err);
    } finally {
      this.running = false;
    }
  }

  async resolveExpiredMatches(now = new Date()): Promise<void> {
    const expired = await this.prisma.match.findMany({
      where: { status: MatchStatus.IN_PROGRESS, expiresAt: { lte: now } },
      select: { id: true, expiresAt: true },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });

    for (const match of expired) {
      try {
        if (await this.awaitingJudging(match.id, match.expiresAt!, now)) continue;
        await this.finalization.resolveTimeout(match.id);
      } catch (err) {
        this.logger.error(
          `Failed to resolve expired match ${match.id}`,
          err instanceof Error ? err.stack : err,
        );
      }
    }
  }

  private async awaitingJudging(matchId: string, expiresAt: Date, now: Date) {
    if (now.getTime() - expiresAt.getTime() >= this.battle.judgeGraceMs) return false;
    const pending = await this.prisma.submission.count({
      where: {
        matchId,
        status: { in: PENDING_SUBMISSION },
        createdAt: { lte: expiresAt },
      },
    });
    return pending > 0;
  }

  /**
   * A later duplicate verdict for one of these is ignored by
   * RunnerResultService, because its claim only moves QUEUED/RUNNING rows.
   */
  async failStuckSubmissions(now = new Date()): Promise<void> {
    const result = await this.prisma.submission.updateMany({
      where: {
        status: { in: PENDING_SUBMISSION },
        createdAt: { lt: new Date(now.getTime() - STUCK_SUBMISSION_MS) },
      },
      data: { status: SubmissionStatus.SYSTEM_ERROR, completedAt: now },
    });
    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} stuck submission(s) SYSTEM_ERROR`);
    }
  }

  private async retryUnratedMatches(): Promise<void> {
    const unrated = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.FINISHED,
        ratingProcessedAt: null,
        // Give the in-line attempt in afterFinish a chance to land first.
        finishedAt: { lt: new Date(Date.now() - 10_000) },
      },
      select: { id: true },
      take: 25,
    });
    for (const match of unrated) {
      this.logger.warn(`Retrying unapplied rating for match ${match.id}`);
      await this.finalization.applyRatingSafely(match.id);
    }
  }
}
