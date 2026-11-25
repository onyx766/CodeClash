import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RANKED_PLAYERS } from './ranked-players';

/** UserStats.rating's schema default, for a player whose stats row is missing. */
const DEFAULT_RATING = 1200;

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ranked standings. rating/wins/losses are ranked-only stats (see
   * UserStats) - casual private-room results never touch them, so they can't
   * move the leaderboard; RatingService enforces that.
   *
   * Only active player accounts are ranked (RANKED_PLAYERS). Ranks follow
   * standard competition ranking: equal ratings share a rank and the next
   * rating's rank skips accordingly (1, 1, 1, 4, ...).
   */
  async top(limit = 50) {
    const rows = await this.prisma.user.findMany({
      where: RANKED_PLAYERS,
      orderBy: [
        { stats: { rating: 'desc' } },
        { stats: { wins: 'desc' } },
        { username: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        username: true,
        profile: { select: { displayName: true, avatarUrl: true } },
        stats: {
          select: {
            rating: true,
            wins: true,
            losses: true,
            matchesPlayed: true,
            totalScore: true,
          },
        },
      },
    });

    // The rows are the top of the rating order, so the first row of each
    // rating comes right after every player rated strictly higher: its rank
    // is 1 + that count, the rule ProfilesService.getGlobalRank applies.
    let rank = 0;
    let previousRating: number | null = null;
    return rows.map((row, index) => {
      const rating = row.stats?.rating ?? DEFAULT_RATING;
      if (rating !== previousRating) rank = index + 1;
      previousRating = rating;
      return {
        rank,
        id: row.id,
        username: row.username,
        displayName: row.profile?.displayName ?? null,
        avatarUrl: row.profile?.avatarUrl ?? null,
        rating,
        wins: row.stats?.wins ?? 0,
        losses: row.stats?.losses ?? 0,
        matchesPlayed: row.stats?.matchesPlayed ?? 0,
        totalScore: row.stats?.totalScore ?? 0,
      };
    });
  }
}
