import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async top(limit = 50) {
    return this.prisma.user.findMany({ orderBy: { rating: 'desc' }, take: limit, select: { id: true, username: true, rating: true, wins: true, losses: true, totalScore: true } });
  }
}
