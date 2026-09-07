import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async top(limit = 50) {
    // rating/wins/losses are ranked-only stats (see UserStats) - casual
    // private-room results never touch them, so they can't move the
    // leaderboard. See RatingService for the enforcement.
    const rows = await this.prisma.user.findMany({
      orderBy: { stats: { rating: 'desc' } },
      take: limit,
      select: {
        id: true,
        username: true,
        stats: {
          select: { rating: true, wins: true, losses: true, totalScore: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      rating: row.stats?.rating ?? 1200,
      wins: row.stats?.wins ?? 0,
      losses: row.stats?.losses ?? 0,
      totalScore: row.stats?.totalScore ?? 0,
    }));
  }
}
