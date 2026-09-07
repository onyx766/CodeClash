import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class InvitationsController {
  constructor(private svc: InvitationsService) {}

  @Post('rooms/:roomId/invite')
  async invite(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Body() body: CreateInvitationDto,
  ) {
    return this.svc.invite(req.user.id, roomId, body.username);
  }

  @Get('invitations/me')
  async mine(@Request() req: any) {
    return this.svc.listMine(req.user.id);
  }

  @Post('invitations/:id/accept')
  async accept(@Request() req: any, @Param('id') id: string) {
    return this.svc.accept(req.user.id, id);
  }

  @Post('invitations/:id/decline')
  async decline(@Request() req: any, @Param('id') id: string) {
    return this.svc.decline(req.user.id, id);
  }
}
