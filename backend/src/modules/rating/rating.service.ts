import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MatchChallengeStatus,
  MatchResultType,
  MatchStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InvalidMatchStateException } from '../../common/exceptions/app.exception';
import { calculateEloChange, calculateEloDrawChange } from './elo.util';

export interface RatingResult {
  /** Rating change per player id. Always 0 for casual matches. */
  changes: Record<string, number>;
  alreadyProcessed?: boolean;
}

/**
 * Anti-rigging hard rule (spec section 5): this is the last line of defense
 * against rating farming. It re-checks match state and rating eligibility
 * independently of whatever the Room/Match creation layers already decided -
 * so even a future bug that calls this for a private match cannot move
 * rating, because ratingEligible/status/duplicate checks happen here too.
 *
 * Never accepts a client-supplied winnerId/score/ratingChange - operates only
 * on a matchId and reads the already-persisted, server-determined match state.
 *
 * Exactly-once: the ratingProcessedAt stamp is a conditional claim made inside
 * the same transaction as every stats/history write, so two concurrent calls
 * (the in-line call after a finish and the sweeper's retry) cannot both apply.
 */
@Injectable()
export class RatingService {
  constructor(private prisma: PrismaService) {}

  async applyMatchRating(matchId: string): Promise<RatingResult> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true },
    });
    if (!match) throw new NotFoundException('Match not found');

    if (match.status !== MatchStatus.FINISHED) {
      throw new InvalidMatchStateException();
    }

    if (match.ratingProcessedAt) {
      return { changes: {}, alreadyProcessed: true };
    }

    const playerIds = match.participants.map((p) => p.userId);
    if (playerIds.length !== 2) {
      throw new InvalidMatchStateException('Match does not have two players.');
    }

    if (match.resultType === MatchResultType.DRAW) {
      const [a, b] = playerIds;
      return match.ratingEligible
        ? this.applyRankedDraw(matchId, a, b)
        : this.applyCasualDraw(matchId, a, b);
    }

    if (!match.winnerId || !playerIds.includes(match.winnerId)) {
      throw new InvalidMatchStateException('Match has no winner recorded.');
    }
    const loserId = playerIds.find((userId) => userId !== match.winnerId)!;

    return match.ratingEligible
      ? this.applyRankedResult(matchId, match.winnerId, loserId)
      : this.applyCasualResult(matchId, match.winnerId, loserId);
  }

  /**
   * Runs `apply` only if this caller is the one that stamps ratingProcessedAt.
   * The stamp and the writes share a transaction, so a failure rolls both back
   * and leaves the match for the sweeper to retry.
   */
  private claimAndApply(
    matchId: string,
    apply: (tx: Prisma.TransactionClient) => Promise<Record<string, number>>,
  ): Promise<RatingResult> {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.match.updateMany({
        where: { id: matchId, ratingProcessedAt: null },
        data: { ratingProcessedAt: new Date() },
      });
      if (claim.count !== 1) return { changes: {}, alreadyProcessed: true };
      return { changes: await apply(tx) };
    });
  }

  private applyCasualResult(matchId: string, winnerId: string, loserId: string) {
    // Hard rule: private/casual matches never create RatingHistory rows and
    // never change rating, no matter what called this method.
    return this.claimAndApply(matchId, async (tx) => {
      await tx.userStats.update({
        where: { userId: winnerId },
        data: { casualWins: { increment: 1 }, casualMatchesPlayed: { increment: 1 } },
      });
      await tx.userStats.update({
        where: { userId: loserId },
        data: { casualLosses: { increment: 1 }, casualMatchesPlayed: { increment: 1 } },
      });
      await this.recordRatingAfter(tx, matchId, [winnerId, loserId]);
      return { [winnerId]: 0, [loserId]: 0 };
    });
  }

  private applyCasualDraw(matchId: string, a: string, b: string) {
    return this.claimAndApply(matchId, async (tx) => {
      for (const userId of [a, b]) {
        await tx.userStats.update({
          where: { userId },
          data: { casualDraws: { increment: 1 }, casualMatchesPlayed: { increment: 1 } },
        });
      }
      await this.recordRatingAfter(tx, matchId, [a, b]);
      return { [a]: 0, [b]: 0 };
    });
  }

  private applyRankedResult(matchId: string, winnerId: string, loserId: string) {
    return this.claimAndApply(matchId, async (tx) => {
      const [winnerStats, loserStats] = await this.loadStats(tx, [winnerId, loserId]);
      const change = calculateEloChange(winnerStats.rating, loserStats.rating);
      const newWinnerStreak = winnerStats.currentStreak + 1;

      await tx.userStats.update({
        where: { userId: winnerId },
        data: {
          rating: { increment: change },
          wins: { increment: 1 },
          matchesPlayed: { increment: 1 },
          currentStreak: newWinnerStreak,
          bestStreak: Math.max(winnerStats.bestStreak, newWinnerStreak),
        },
      });
      await tx.userStats.update({
        where: { userId: loserId },
        data: {
          rating: { decrement: change },
          losses: { increment: 1 },
          matchesPlayed: { increment: 1 },
          currentStreak: 0,
        },
      });
      await this.recordHistory(tx, matchId, winnerId, winnerStats.rating, change);
      await this.recordHistory(tx, matchId, loserId, loserStats.rating, -change);
      return { [winnerId]: change, [loserId]: -change };
    });
  }

  /**
   * A ranked draw moves the ratings towards each other (Elo score 0.5) and
   * ends both win streaks. Exception: when neither player solved anything the
   * match was not actually played, so rating is left alone - the same reason
   * the round format never rated an unplayed match - and no RatingHistory row
   * is written.
   */
  private applyRankedDraw(matchId: string, a: string, b: string) {
    return this.claimAndApply(matchId, async (tx) => {
      const solved = await tx.matchChallengeProgress.count({
        where: { status: MatchChallengeStatus.SOLVED, matchChallenge: { matchId } },
      });
      const [statsA, statsB] = await this.loadStats(tx, [a, b]);
      const change = solved > 0 ? calculateEloDrawChange(statsA.rating, statsB.rating) : 0;

      await tx.userStats.update({
        where: { userId: a },
        data: {
          rating: { increment: change },
          draws: { increment: 1 },
          matchesPlayed: { increment: 1 },
          currentStreak: 0,
        },
      });
      await tx.userStats.update({
        where: { userId: b },
        data: {
          rating: { decrement: change },
          draws: { increment: 1 },
          matchesPlayed: { increment: 1 },
          currentStreak: 0,
        },
      });
      if (solved > 0) {
        await this.recordHistory(tx, matchId, a, statsA.rating, change);
        await this.recordHistory(tx, matchId, b, statsB.rating, -change);
      } else {
        await this.recordRatingAfter(tx, matchId, [a, b]);
      }
      return { [a]: change, [b]: -change };
    });
  }

  private async loadStats(tx: Prisma.TransactionClient, userIds: [string, string]) {
    const stats = await Promise.all(
      userIds.map((userId) => tx.userStats.findUnique({ where: { userId } })),
    );
    if (stats.some((s) => !s)) {
      throw new InvalidMatchStateException('Missing stats for a match player.');
    }
    return stats as NonNullable<(typeof stats)[number]>[];
  }

  private async recordHistory(
    tx: Prisma.TransactionClient,
    matchId: string,
    userId: string,
    previousRating: number,
    change: number,
  ) {
    await tx.ratingHistory.create({
      data: { userId, matchId, previousRating, newRating: previousRating + change, change },
    });
    await tx.matchParticipant.update({
      where: { matchId_userId: { matchId, userId } },
      data: { ratingAfter: previousRating + change },
    });
  }

  /** Rating did not move: ratingAfter is the snapshot taken at match start. */
  private async recordRatingAfter(
    tx: Prisma.TransactionClient,
    matchId: string,
    userIds: string[],
  ) {
    for (const userId of userIds) {
      const participant = await tx.matchParticipant.findUnique({
        where: { matchId_userId: { matchId, userId } },
        select: { ratingBefore: true },
      });
      if (participant) {
        await tx.matchParticipant.update({
          where: { matchId_userId: { matchId, userId } },
          data: { ratingAfter: participant.ratingBefore },
        });
      }
    }
  }
}
