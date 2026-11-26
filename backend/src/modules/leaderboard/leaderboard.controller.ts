import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

export const LEADERBOARD_DEFAULT_LIMIT = 50;
export const LEADERBOARD_MAX_LIMIT = 100;

/** Parses ?limit=, falling back to the default and clamping to 1..100. */
export function parseLeaderboardLimit(raw?: string): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return LEADERBOARD_DEFAULT_LIMIT;
  return Math.min(LEADERBOARD_MAX_LIMIT, Math.max(1, parsed));
}

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private svc: LeaderboardService) {}

  @Get()
  async list(@Query('limit') limit?: string) {
    return this.svc.top(parseLeaderboardLimit(limit));
  }
}
