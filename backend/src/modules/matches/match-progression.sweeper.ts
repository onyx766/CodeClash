import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MatchProgressionService } from './match-progression.service';

/** How often expired rounds and unrated finished matches are swept. */
export const MATCH_SWEEP_INTERVAL_MS = 2000;

/**
 * The time-driven half of match progression. Submissions close a round the
 * moment both players have sent one; this closes the rounds where that never
 * happens because a player ran out of time, closed the tab, or disconnected -
 * without it, an abandoned match would hang IN_PROGRESS forever and never
 * reach RatingService.
 *
 * It also retries rating for matches that finished but whose rating never
 * landed (process died between the two steps, or the database blipped).
 * RatingService is idempotent via ratingProcessedAt, so a retry that races a
 * still-running first attempt cannot double-apply.
 */
@Injectable()
export class MatchProgressionSweeper {
  private readonly logger = new Logger(MatchProgressionSweeper.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private progression: MatchProgressionService,
  ) {}

  @Interval(MATCH_SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    // Ticks are 2s apart but a sweep can outlast that under load; overlapping
    // runs would just contend on the same conditional claims.
    if (this.running) return;
    this.running = true;
    try {
      await this.closeExpiredRounds();
      await this.retryUnratedMatches();
    } catch (err) {
      this.logger.error(
        'Match progression sweep failed',
        err instanceof Error ? err.stack : err,
      );
    } finally {
      this.running = false;
    }
  }

  private async closeExpiredRounds(): Promise<void> {
    const expired = await this.prisma.round.findMany({
      where: {
        finishedAt: null,
        endsAt: { not: null, lte: new Date() },
        match: { status: MatchStatus.IN_PROGRESS },
      },
      select: { id: true },
      take: 100,
    });

    for (const round of expired) {
      try {
        await this.progression.maybeCloseRound(round.id);
      } catch (err) {
        // One bad round must not stop the rest of the sweep.
        this.logger.error(
          `Failed to close expired round ${round.id}`,
          err instanceof Error ? err.stack : err,
        );
      }
    }
  }

  private async retryUnratedMatches(): Promise<void> {
    const unrated = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.FINISHED,
        winnerId: { not: null },
        ratingProcessedAt: null,
        // Give the in-line attempt in finishMatch a chance to land first, so
        // the sweeper only picks up genuinely stuck matches.
        finishedAt: { lt: new Date(Date.now() - 10_000) },
      },
      select: { id: true },
      take: 25,
    });

    for (const match of unrated) {
      this.logger.warn(`Retrying unapplied rating for match ${match.id}`);
      await this.progression.applyRatingSafely(match.id);
    }
  }
}
