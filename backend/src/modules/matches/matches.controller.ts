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

  /** Declared before ':matchId/state' would ever be reached with 'me' as an
   * id - Nest matches routes in declaration order, so the literal path has to
   * come first. */
  @UseGuards(JwtAuthGuard)
  @Get('me/active')
  async active(@Request() req: any) {
    return this.svc.getActiveMatchForUser(req.user.id);
  }

  /**
   * Full playable state: challenge text, deadline, per-round results, and
   * whether this player has already submitted. Participants only - the
   * service enforces that, and filters hidden test cases and the opponent's
   * in-flight result out of the response.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':matchId/state')
  async state(@Request() req: any, @Param('matchId') matchId: string) {
    return this.svc.getMatchState(matchId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':matchId')
  async get(@Request() req: any, @Param('matchId') matchId: string) {
    return this.svc.getMatchState(matchId, req.user.id);
  }

  // Quick Match ready confirmation only - private-room readiness still uses
  // the existing room:ready socket flow (see MatchesService.startMatch).
  @UseGuards(JwtAuthGuard)
  @Post(':matchId/ready')
  async ready(@Request() req: any, @Param('matchId') matchId: string) {
    return this.matchmaking.handleReady(matchId, req.user.id);
  }
}
