import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SocketGateway } from '../../socket/socket.gateway';

type MockPrisma = {
  room: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  roomPlayer: { create: jest.Mock; count: jest.Mock; findFirst: jest.Mock; deleteMany: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
};

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: MockPrisma;
  let redisClient: {
    sadd: jest.Mock;
    expire: jest.Mock;
    srem: jest.Mock;
    del: jest.Mock;
    zscore: jest.Mock;
    multi: jest.Mock;
  };
  let queued: { zrem: jest.Mock; del: jest.Mock; exec: jest.Mock };
  let socket: { broadcastRoom: jest.Mock; emitToUser: jest.Mock };

  const HOST_ID = 'host-1';
  const ROOM = { id: 'room-1', code: 'ABC123', hostId: HOST_ID, maxPlayers: 2 };

  beforeEach(async () => {
    queued = { zrem: jest.fn(), del: jest.fn(), exec: jest.fn().mockResolvedValue([]) };
    queued.zrem.mockReturnValue(queued);
    queued.del.mockReturnValue(queued);
    redisClient = {
      sadd: jest.fn(),
      expire: jest.fn(),
      srem: jest.fn(),
      del: jest.fn(),
      zscore: jest.fn().mockResolvedValue(null), // not searching by default
      multi: jest.fn(() => queued),
    };
    socket = { broadcastRoom: jest.fn().mockResolvedValue(undefined), emitToUser: jest.fn() };

    prisma = {
      room: {
        findUnique: jest.fn().mockResolvedValue(null), // no code collision
        findFirst: jest.fn().mockResolvedValue(null), // no existing hosted room
        create: jest.fn().mockResolvedValue(ROOM),
        findMany: jest.fn().mockResolvedValue([ROOM]),
      },
      roomPlayer: {
        create: jest.fn().mockResolvedValue({ id: 'rp-1', roomId: ROOM.id, userId: HOST_ID }),
        count: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      // Interactive transactions run the callback against the same mocks.
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { getClient: () => redisClient } },
        { provide: SocketGateway, useValue: socket },
      ],
    }).compile();

    service = module.get(RoomsService);
  });

  describe('createRoom', () => {
    it('always reports PRIVATE_ROOM/CASUAL with ratingEligible false', async () => {
      const result = await service.createRoom(HOST_ID);
      expect(result).toMatchObject({
        type: 'PRIVATE_ROOM',
        mode: 'CASUAL',
        ratingEligible: false,
        ratingMessage: 'Private room matches do not affect rating.',
      });
    });

    it('never persists a ranked/ratingEligible flag - room.create ignores it', async () => {
      await service.createRoom(HOST_ID);
      const createArgs = prisma.room.create.mock.calls[0][0];
      expect(createArgs.data).not.toHaveProperty('ranked');
      expect(createArgs.data).not.toHaveProperty('ratingEligible');
    });

    it('rejects a second room from the same host while one is still active', async () => {
      prisma.room.findFirst.mockResolvedValue(ROOM);
      await expect(service.createRoom(HOST_ID)).rejects.toMatchObject({
        code: 'ROOM_ALREADY_HOSTED',
      });
      expect(prisma.room.create).not.toHaveBeenCalled();
    });

    it('allows a new room once the host has no active room', async () => {
      prisma.room.findFirst.mockResolvedValue(null);
      await expect(service.createRoom(HOST_ID)).resolves.toMatchObject({
        type: 'PRIVATE_ROOM',
      });
    });
  });

  describe('getRoom', () => {
    it('always reports casual metadata regardless of room state', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...ROOM, players: [] });
      const result = await service.getRoom(ROOM.id);
      expect(result).toMatchObject({ type: 'PRIVATE_ROOM', mode: 'CASUAL', ratingEligible: false });
    });
  });

  describe('createRoom capacity', () => {
    it('always creates a two-seat room', async () => {
      await service.createRoom(HOST_ID);
      expect(prisma.room.create.mock.calls[0][0].data.maxPlayers).toBe(2);
    });
  });

  describe('getRoom visibility', () => {
    const roomWithPlayers = { ...ROOM, players: [{ userId: HOST_ID }, { userId: 'guest-1' }] };

    it('lets the room\'s players and staff read it', async () => {
      prisma.room.findUnique.mockResolvedValue(roomWithPlayers);
      await expect(service.getRoom(ROOM.id, { id: 'guest-1', role: 'USER' as never })).resolves.toMatchObject({
        id: ROOM.id,
      });
      await expect(service.getRoom(ROOM.id, { id: 'staff-1', role: 'ADMIN' as never })).resolves.toMatchObject({
        id: ROOM.id,
      });
    });

    it('answers 404 to anyone else, without revealing the room or its code', async () => {
      prisma.room.findUnique.mockResolvedValue(roomWithPlayers);
      await expect(
        service.getRoom(ROOM.id, { id: 'stranger', role: 'USER' as never }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('joinRoomById', () => {
    beforeEach(() => {
      prisma.room.findUnique.mockResolvedValue({ ...ROOM, expiresAt: null, match: null });
    });

    it('checks capacity and inserts under a row lock on the room', async () => {
      prisma.roomPlayer.count.mockResolvedValue(1);
      prisma.roomPlayer.findFirst.mockResolvedValue(null);

      await service.joinRoomById('guest-1', ROOM.id);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.roomPlayer.create).toHaveBeenCalledWith({ data: { roomId: ROOM.id, userId: 'guest-1' } });
    });

    it('pushes the new roster to the room', async () => {
      prisma.roomPlayer.count.mockResolvedValue(1);
      prisma.roomPlayer.findFirst.mockResolvedValue(null);
      await service.joinRoomById('guest-1', ROOM.id);
      expect(socket.broadcastRoom).toHaveBeenCalledWith(ROOM.id);
    });

    it('refuses to seat a third player', async () => {
      prisma.roomPlayer.count.mockResolvedValue(2);
      await expect(service.joinRoomById('guest-2', ROOM.id)).rejects.toThrow('Room is full');
      expect(prisma.roomPlayer.create).not.toHaveBeenCalled();
    });
  });

  describe('leaveRoom', () => {
    it('tells the room when a player leaves, including when the host cancels it', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...ROOM, match: null, status: 'WAITING' });
      (prisma as any).roomInvitation = { deleteMany: jest.fn() };
      (prisma as any).room.delete = jest.fn();
      prisma.$transaction.mockResolvedValue([]);
      prisma.roomPlayer.count.mockResolvedValue(1);

      await service.leaveRoom(HOST_ID, ROOM.id);

      expect(socket.broadcastRoom).toHaveBeenCalledWith(ROOM.id);
    });

    it('never fails the request when the push fails', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...ROOM, match: null, status: 'WAITING' });
      prisma.roomPlayer.count.mockResolvedValue(1);
      socket.broadcastRoom.mockRejectedValue(new Error('socket down'));

      await expect(service.leaveRoom('guest-1', ROOM.id)).resolves.toEqual({ success: true });
    });
  });

  describe('Quick Match interplay', () => {
    it('ends a running Quick Match search when the player creates a room', async () => {
      redisClient.zscore.mockResolvedValue('1200'); // rating and joinedAt present
      await service.createRoom(HOST_ID);
      expect(queued.exec).toHaveBeenCalled();
      expect(socket.emitToUser).toHaveBeenCalledWith(HOST_ID, 'matchmaking:cancelled', { reason: 'JOINED_ROOM' });
    });

    it('leaves players who are not searching alone', async () => {
      await service.createRoom(HOST_ID);
      expect(redisClient.multi).not.toHaveBeenCalled();
      expect(socket.emitToUser).not.toHaveBeenCalled();
    });

    it('ends the search when the player joins someone else\'s room', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...ROOM, expiresAt: null, match: null });
      prisma.roomPlayer.count.mockResolvedValue(1);
      prisma.roomPlayer.findFirst.mockResolvedValue(null);
      redisClient.zscore.mockResolvedValue('1200');

      await service.joinRoomById('guest-1', ROOM.id);

      expect(socket.emitToUser).toHaveBeenCalledWith('guest-1', 'matchmaking:cancelled', { reason: 'JOINED_ROOM' });
    });
  });
});
