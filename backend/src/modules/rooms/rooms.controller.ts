import { Body, Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchesService } from '../matches/matches.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    private svc: RoomsService,
    private matches: MatchesService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() _body: CreateRoomDto) {
    // Battles are always 1v1; CreateRoomDto only accepts maxPlayers = 2.
    return this.svc.createRoom(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('join')
  async join(@Request() req: any, @Body() body: JoinRoomDto) {
    return this.svc.joinRoomByCode(req.user.id, body.code);
  }

  /** Host only. Idempotent - a repeat returns the match already created. */
  @UseGuards(JwtAuthGuard)
  @Post(':code/start')
  async start(@Request() req: any, @Param('code') code: string) {
    return this.matches.startPrivateRoomMatch(code.trim().toUpperCase(), req.user.id);
  }

  /** The room's own players (and staff) only - the payload includes the join code. */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(@Request() req: any, @Param('id') id: string) {
    return this.svc.getRoom(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  async leave(@Request() req: any, @Param('id') id: string) {
    return this.svc.leaveRoom(req.user.id, id);
  }

}
