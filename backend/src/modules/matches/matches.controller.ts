import { Controller, Post, UseGuards, Request, Param, Get } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('matches')
export class MatchesController {
  constructor(private svc: MatchesService) {}

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
}
