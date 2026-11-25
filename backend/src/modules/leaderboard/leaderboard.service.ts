import { Injectable } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ranked standings. rating/wins/losses are ranked-only stats (see
   * UserStats) - casual private-room results never touch them, so they can't
   * move the leaderboard; RatingService enforces that.
   *
   * Only active player accounts are ranked: staff accounts (whose seeded
   * ratings are not earned) and banned players are left out.
   */
  async top(limit = 50) {
    const rows = await this.prisma.user.findMany({
      where: { role: Role.USER, status: UserStatus.ACTIVE },
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

    return rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      displayName: row.profile?.displayName ?? null,
      avatarUrl: row.profile?.avatarUrl ?? null,
      rating: row.stats?.rating ?? 1200,
      wins: row.stats?.wins ?? 0,
      losses: row.stats?.losses ?? 0,
      matchesPlayed: row.stats?.matchesPlayed ?? 0,
      totalScore: row.stats?.totalScore ?? 0,
    }));
  }
}
