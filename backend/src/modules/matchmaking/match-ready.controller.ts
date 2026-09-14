import { Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchmakingService } from './matchmaking.service';

/**
 * Quick Match ready confirmation. Lives in the matchmaking module (under the
 * /matches path the frontend already uses) so MatchesModule never has to
 * depend on MatchmakingModule.
 */
@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchReadyController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @Post(':matchId/ready')
  ready(@Req() req: Request, @Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.matchmaking.handleReady(matchId, req.user!.id);
  }
}
