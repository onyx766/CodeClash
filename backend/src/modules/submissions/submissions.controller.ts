import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubmissionsService } from './submissions.service';
import { SubmitCodeDto } from './dto/submit-code.dto';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /** Public tests only; never solves anything. */
  @Throttle({ default: { limit: 20, ttl: 10_000 } })
  @Post(':matchId/challenges/:matchChallengeId/run')
  run(
    @Req() req: Request,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Param('matchChallengeId', ParseUUIDPipe) matchChallengeId: string,
    @Body() body: SubmitCodeDto,
  ) {
    return this.submissions.runTests(req.user!.id, matchId, matchChallengeId, body.code);
  }

  /** Public + hidden tests; an ACCEPTED verdict solves the challenge. */
  @Throttle({ default: { limit: 10, ttl: 10_000 } })
  @Post(':matchId/challenges/:matchChallengeId/submit')
  submit(
    @Req() req: Request,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Param('matchChallengeId', ParseUUIDPipe) matchChallengeId: string,
    @Body() body: SubmitCodeDto,
  ) {
    return this.submissions.submit(req.user!.id, matchId, matchChallengeId, body.code);
  }
}
