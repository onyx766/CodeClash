import { Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchmakingService } from './matchmaking.service';

@Controller('matchmaking/quick')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  // Deliberately ignores any request body - rating/opponent are always
  // server-derived, never client-supplied (spec section 6/54).
  @Throttle({ default: { limit: 20, ttl: 10_000 } })
  @Post()
  async start(@Req() req: Request) {
    const matchmakingState = await this.matchmaking.startSearch(req.user!.id);
    return { success: true, matchmaking: matchmakingState };
  }

  @Get()
  async status(@Req() req: Request) {
    const matchmakingState = await this.matchmaking.getStatus(req.user!.id);
    return { success: true, matchmaking: matchmakingState };
  }

  @Throttle({ default: { limit: 20, ttl: 10_000 } })
  @Delete()
  async cancel(@Req() req: Request) {
    const matchmakingState = await this.matchmaking.cancelSearch(req.user!.id);
    return { success: true, matchmaking: matchmakingState };
  }
}
