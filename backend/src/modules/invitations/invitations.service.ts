import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { SocketEvents } from '../../socket/socket.events';
import {
  InvitationAlreadyHandledException,
  InvitationNotFoundException,
} from '../../common/exceptions/app.exception';

// Explicit select, never `user: true` - an invitation must never expose
// passwordHash/email for either side of the invite.
const inviteInclude = {
  inviter: { select: { id: true, username: true } },
  room: {
    select: {
      id: true,
      code: true,
      maxPlayers: true,
      status: true,
      _count: { select: { players: true } },
    },
  },
} as const;

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private rooms: RoomsService,
    private socket: SocketGateway,
  ) {}

  async invite(inviterId: string, roomId: string, inviteeUsername: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.hostId !== inviterId) {
      throw new ForbiddenException('Only the room host can invite players.');
    }

    const invitee = await this.prisma.user.findUnique({ where: { username: inviteeUsername } });
    if (!invitee) throw new NotFoundException('No user with this username was found.');
    if (invitee.id === inviterId) throw new BadRequestException('You cannot invite yourself.');

    const alreadyInRoom = await this.prisma.roomPlayer.findFirst({
      where: { roomId, userId: invitee.id },
    });
    if (alreadyInRoom) throw new BadRequestException('That player is already in the room.');

    const players = await this.prisma.roomPlayer.count({ where: { roomId } });
    if (players >= room.maxPlayers) throw new BadRequestException('Room is full.');

    const pending = await this.prisma.roomInvitation.findFirst({
      where: { roomId, inviteeId: invitee.id, status: 'PENDING' },
    });
    if (pending) {
      throw new BadRequestException('That player already has a pending invite to this room.');
    }

    const invitation = await this.prisma.roomInvitation.create({
      data: { roomId, inviterId, inviteeId: invitee.id },
      include: inviteInclude,
    });
    // Same shape as GET /invitations/me (inviter {id, username}, room summary).
    this.socket.emitToUser(invitee.id, SocketEvents.INVITATION_RECEIVED, { invitation });
    return invitation;
  }

  async listMine(userId: string) {
    return this.prisma.roomInvitation.findMany({
      where: { inviteeId: userId, status: 'PENDING' },
      include: inviteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(userId: string, invitationId: string) {
    const invitation = await this.findPendingForUser(userId, invitationId);
    const { room } = await this.rooms.joinRoomById(userId, invitation.roomId);
    await this.prisma.roomInvitation.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    this.notifyInviter(invitation, 'ACCEPTED');
    return { room };
  }

  async decline(userId: string, invitationId: string) {
    const invitation = await this.findPendingForUser(userId, invitationId);
    await this.prisma.roomInvitation.update({
      where: { id: invitationId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    this.notifyInviter(invitation, 'DECLINED');
    return { success: true };
  }

  /** Ids and status only - the inviter already knows who they invited. */
  private notifyInviter(
    invitation: { id: string; roomId: string; inviterId: string; inviteeId: string },
    status: 'ACCEPTED' | 'DECLINED',
  ) {
    this.socket.emitToUser(invitation.inviterId, SocketEvents.INVITATION_UPDATED, {
      invitationId: invitation.id,
      roomId: invitation.roomId,
      inviteeId: invitation.inviteeId,
      status,
    });
  }

  private async findPendingForUser(userId: string, invitationId: string) {
    const invitation = await this.prisma.roomInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.inviteeId !== userId) throw new InvitationNotFoundException();
    if (invitation.status !== 'PENDING') throw new InvitationAlreadyHandledException();
    return invitation;
  }
}
