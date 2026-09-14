import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MatchesService, MatchViewer } from './matches.service';
import { MatchFinalizationService } from './match-finalization.service';

const viewerOf = (req: Request): MatchViewer => ({ id: req.user!.id, role: req.user!.role });

/**
 * Player-facing battle API. Every route is participant-only (ADMIN and above
 * may read any match); none accepts a body that could decide an outcome.
 * Run/Submit live in SubmissionsController, Quick Match ready confirmation in
 * MatchReadyController, and private-room start at POST /rooms/:code/start.
 */
@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly finalization: MatchFinalizationService,
  ) {}

  @Get('me/active')
  active(@Req() req: Request) {
    return this.matches.getActiveMatchForUser(req.user!.id);
  }

  @Get('me/history')
  history(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.matches.getMatchHistoryForUser(
      req.user!.id,
      Number(page) || 1,
      Number(pageSize) || 10,
    );
  }

  @Get(':matchId')
  get(@Req() req: Request, @Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.matches.getMatch(matchId, viewerOf(req));
  }

  @Get(':matchId/challenges')
  challenges(@Req() req: Request, @Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.matches.getChallenges(matchId, viewerOf(req));
  }

  @Get(':matchId/progress')
  progress(@Req() req: Request, @Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.matches.getProgress(matchId, viewerOf(req));
  }

  @Throttle({ default: { limit: 10, ttl: 10_000 } })
  @Post(':matchId/give-up')
  giveUp(@Req() req: Request, @Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.finalization.giveUp(matchId, req.user!.id);
  }

  /** System/admin cancellation - unrated for both players. */
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':matchId/cancel')
  async cancel(@Param('matchId', ParseUUIDPipe) matchId: string) {
    const cancelled = await this.finalization.cancelMatch(matchId, 'ADMIN_CANCELLED');
    return { success: true, cancelled, match: await this.finalization.resultSummary(matchId) };
  }
}
