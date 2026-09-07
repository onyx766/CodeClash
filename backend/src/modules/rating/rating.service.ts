import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InvalidMatchStateException } from '../../common/exceptions/app.exception';
import { calculateEloChange } from './elo.util';

export interface RatingResult {
  winnerChange: number;
  loserChange: number;
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
 */
@Injectable()
export class RatingService {
  constructor(private prisma: PrismaService) {}

  async applyMatchRating(matchId: string): Promise<RatingResult> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { room: { include: { players: true } } },
    });
    if (!match) throw new NotFoundException('Match not found');

    if (match.status !== MatchStatus.FINISHED) {
      throw new InvalidMatchStateException();
    }

    // Idempotency guard: retries/reconnects/background jobs must never apply
    // rating twice. Checked before any stats are touched.
    if (match.ratingProcessedAt) {
      return { winnerChange: 0, loserChange: 0, alreadyProcessed: true };
    }

    if (!match.winnerId) {
      throw new InvalidMatchStateException('Match has no winner recorded.');
    }
    const loserId = match.room.players
      .map((p) => p.userId)
      .find((userId) => userId !== match.winnerId);
    if (!loserId) {
      throw new InvalidMatchStateException('Match does not have two players.');
    }

    if (!match.ratingEligible) {
      return this.applyCasualResult(matchId, match.winnerId, loserId);
    }

    return this.applyRankedResult(matchId, match.winnerId, loserId);
  }

  private async applyCasualResult(
    matchId: string,
    winnerId: string,
    loserId: string,
  ): Promise<RatingResult> {
    // Hard rule: private/casual matches never create RatingHistory rows and
    // never change rating, no matter what called this method.
    await this.prisma.$transaction([
      this.prisma.userStats.update({
        where: { userId: winnerId },
        data: { casualWins: { increment: 1 }, casualMatchesPlayed: { increment: 1 } },
      }),
      this.prisma.userStats.update({
        where: { userId: loserId },
        data: { casualLosses: { increment: 1 }, casualMatchesPlayed: { increment: 1 } },
      }),
      this.prisma.match.update({
        where: { id: matchId },
        data: { ratingProcessedAt: new Date() },
      }),
    ]);
    return { winnerChange: 0, loserChange: 0 };
  }

  private async applyRankedResult(
    matchId: string,
    winnerId: string,
    loserId: string,
  ): Promise<RatingResult> {
    const [winnerStats, loserStats] = await Promise.all([
      this.prisma.userStats.findUnique({ where: { userId: winnerId } }),
      this.prisma.userStats.findUnique({ where: { userId: loserId } }),
    ]);
    if (!winnerStats || !loserStats) {
      throw new InvalidMatchStateException('Missing stats for a match player.');
    }

    const change = calculateEloChange(winnerStats.rating, loserStats.rating);
    const newWinnerStreak = winnerStats.currentStreak + 1;
    const now = new Date();

    // Atomic: winner rating, loser rating, both history rows, and the
    // processed stamp all land together or none do (spec section 15).
    await this.prisma.$transaction([
      this.prisma.userStats.update({
        where: { userId: winnerId },
        data: {
          rating: { increment: change },
          wins: { increment: 1 },
          matchesPlayed: { increment: 1 },
          currentStreak: newWinnerStreak,
          bestStreak: Math.max(winnerStats.bestStreak, newWinnerStreak),
        },
      }),
      this.prisma.userStats.update({
        where: { userId: loserId },
        data: {
          rating: { decrement: change },
          losses: { increment: 1 },
          matchesPlayed: { increment: 1 },
          currentStreak: 0,
        },
      }),
      this.prisma.ratingHistory.create({
        data: {
          userId: winnerId,
          matchId,
          previousRating: winnerStats.rating,
          newRating: winnerStats.rating + change,
          change,
        },
      }),
      this.prisma.ratingHistory.create({
        data: {
          userId: loserId,
          matchId,
          previousRating: loserStats.rating,
          newRating: loserStats.rating - change,
          change: -change,
        },
      }),
      this.prisma.match.update({
        where: { id: matchId },
        data: { ratingProcessedAt: now },
      }),
    ]);

    return { winnerChange: change, loserChange: -change };
  }
}
