import { Controller, Post, UseGuards, Request, Param, Get } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchmakingService } from '../matchmaking/matchmaking.service';

@Controller('matches')
export class MatchesController {
  constructor(
    private svc: MatchesService,
    private matchmaking: MatchmakingService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('start/:roomId')
  async start(@Request() req: any, @Param('roomId') roomId: string) {
    return this.svc.startMatch(roomId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(@Param('id') id: string) {
    // basic retrieval
    return { id };
  }

  // Quick Match ready confirmation only - private-room readiness still uses
  // the existing room:ready socket flow (see MatchesService.startMatch).
  @UseGuards(JwtAuthGuard)
  @Post(':matchId/ready')
  async ready(@Request() req: any, @Param('matchId') matchId: string) {
    return this.matchmaking.handleReady(matchId, req.user.id);
  }
}
