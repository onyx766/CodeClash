import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private svc: LeaderboardService) {}

  @Get()
  async list(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 50;
    return this.svc.top(l);
  }
}
