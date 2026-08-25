import { Body, Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rooms')
export class RoomsController {
  constructor(private svc: RoomsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() body: CreateRoomDto) {
    return this.svc.createRoom(req.user.id, body.maxPlayers || 2);
  }

  @UseGuards(JwtAuthGuard)
  @Post('join')
  async join(@Request() req: any, @Body() body: { code: string }) {
    return this.svc.joinRoomByCode(req.user.id, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(@Param('id') id: string) {
    return this.svc.getRoom(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  async leave(@Request() req: any, @Param('id') id: string) {
    return this.svc.leaveRoom(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list() {
    return this.svc.listActive();
  }
}
