import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../../database/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { SocketGateway } from '../../socket/socket.gateway';

type MockPrisma = {
  room: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  roomPlayer: { findFirst: jest.Mock; count: jest.Mock };
  roomInvitation: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

describe('InvitationsService', () => {
  let service: InvitationsService;
  let prisma: MockPrisma;
  let rooms: { joinRoomById: jest.Mock };
  let socket: { emitToUser: jest.Mock };

  const HOST_ID = 'host-1';
  const INVITEE_ID = 'invitee-1';
  const ROOM_ID = 'room-1';
  const ROOM = { id: ROOM_ID, code: 'ABC123', hostId: HOST_ID, maxPlayers: 2 };
  const INVITEE = { id: INVITEE_ID, username: 'friend' };
  const INVITATION = { id: 'invite-1', roomId: ROOM_ID, inviterId: HOST_ID, inviteeId: INVITEE_ID, status: 'PENDING' };

  beforeEach(async () => {
    prisma = {
      room: { findUnique: jest.fn().mockResolvedValue(ROOM) },
      user: { findUnique: jest.fn().mockResolvedValue(INVITEE) },
      roomPlayer: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(1),
      },
      roomInvitation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(INVITATION),
        create: jest.fn().mockResolvedValue(INVITATION),
        findMany: jest.fn().mockResolvedValue([INVITATION]),
        update: jest.fn().mockResolvedValue({ ...INVITATION, status: 'ACCEPTED' }),
      },
    };

    rooms = { joinRoomById: jest.fn().mockResolvedValue({ room: ROOM, player: {} }) };
    socket = { emitToUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RoomsService, useValue: rooms },
        { provide: SocketGateway, useValue: socket },
      ],
    }).compile();

    service = module.get(InvitationsService);
  });

  describe('invite', () => {
    it('creates a pending invitation when the inviter hosts the room', async () => {
      await service.invite(HOST_ID, ROOM_ID, 'friend');
      expect(prisma.roomInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { roomId: ROOM_ID, inviterId: HOST_ID, inviteeId: INVITEE_ID } }),
      );
    });

    it('rejects when the room does not exist', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      await expect(service.invite(HOST_ID, ROOM_ID, 'friend')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when the inviter is not the room host', async () => {
      await expect(service.invite('someone-else', ROOM_ID, 'friend')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects when the invitee username does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.invite(HOST_ID, ROOM_ID, 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects inviting yourself', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: HOST_ID, username: 'host' });
      await expect(service.invite(HOST_ID, ROOM_ID, 'host')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the invitee is already in the room', async () => {
      prisma.roomPlayer.findFirst.mockResolvedValue({ id: 'rp-1' });
      await expect(service.invite(HOST_ID, ROOM_ID, 'friend')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the room is full', async () => {
      prisma.roomPlayer.count.mockResolvedValue(ROOM.maxPlayers);
      await expect(service.invite(HOST_ID, ROOM_ID, 'friend')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate pending invite to the same player', async () => {
      prisma.roomInvitation.findFirst.mockResolvedValue(INVITATION);
      await expect(service.invite(HOST_ID, ROOM_ID, 'friend')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listMine', () => {
    it('lists only pending invitations for the given invitee', async () => {
      await service.listMine(INVITEE_ID);
      expect(prisma.roomInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { inviteeId: INVITEE_ID, status: 'PENDING' } }),
      );
    });
  });

  describe('accept', () => {
    it('joins the room and marks the invitation accepted', async () => {
      await service.accept(INVITEE_ID, INVITATION.id);
      expect(rooms.joinRoomById).toHaveBeenCalledWith(INVITEE_ID, ROOM_ID);
      expect(prisma.roomInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: INVITATION.id },
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
      );
    });

    it('rejects when the invitation does not belong to the caller', async () => {
      await expect(service.accept('someone-else', INVITATION.id)).rejects.toMatchObject({
        code: 'INVITATION_NOT_FOUND',
      });
    });

    it('rejects when the invitation was already handled', async () => {
      prisma.roomInvitation.findUnique.mockResolvedValue({ ...INVITATION, status: 'DECLINED' });
      await expect(service.accept(INVITEE_ID, INVITATION.id)).rejects.toMatchObject({
        code: 'INVITATION_ALREADY_HANDLED',
      });
    });
  });

  describe('decline', () => {
    it('marks the invitation declined', async () => {
      await service.decline(INVITEE_ID, INVITATION.id);
      expect(prisma.roomInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: INVITATION.id },
          data: expect.objectContaining({ status: 'DECLINED' }),
        }),
      );
    });

    it('rejects when the invitation does not belong to the caller', async () => {
      await expect(service.decline('someone-else', INVITATION.id)).rejects.toMatchObject({
        code: 'INVITATION_NOT_FOUND',
      });
    });
  });

  describe('real-time notifications', () => {
    it('pushes a new invitation to the invitee', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: INVITEE_ID, username: 'invitee' });
      await service.invite(HOST_ID, ROOM_ID, 'invitee');
      expect(socket.emitToUser).toHaveBeenCalledWith(INVITEE_ID, 'invitation:received', {
        invitation: INVITATION,
      });
    });

    it.each([
      ['accept', 'ACCEPTED'],
      ['decline', 'DECLINED'],
    ] as const)('tells the inviter when the invitee answers (%s)', async (action, status) => {
      await service[action](INVITEE_ID, INVITATION.id);
      expect(socket.emitToUser).toHaveBeenCalledWith(HOST_ID, 'invitation:updated', {
        invitationId: INVITATION.id,
        roomId: ROOM_ID,
        inviteeId: INVITEE_ID,
        status,
      });
    });
  });
});
