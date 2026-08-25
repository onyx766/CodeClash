import { Body, Controller, Post, UseGuards, Request, Param } from '@nestjs/common';
import { RoundsService } from './rounds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rounds')
export class RoundsController {
  constructor(private svc: RoundsService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':roundId/run')
  async run(@Request() req: any, @Param('roundId') roundId: string, @Body() body: { code: string }) {
    return this.svc.runCode(req.user.id, roundId, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':roundId/submit')
  async submit(@Request() req: any, @Param('roundId') roundId: string, @Body() body: { code: string }) {
    return this.svc.submitCode(req.user.id, roundId, body.code);
  }
}
