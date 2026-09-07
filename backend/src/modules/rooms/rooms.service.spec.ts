import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

type MockPrisma = {
  room: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  roomPlayer: { create: jest.Mock; count: jest.Mock; findFirst: jest.Mock; deleteMany: jest.Mock };
};

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: MockPrisma;
  let redisClient: { sadd: jest.Mock; expire: jest.Mock; srem: jest.Mock };

  const HOST_ID = 'host-1';
  const ROOM = { id: 'room-1', code: 'ABC123', hostId: HOST_ID, maxPlayers: 2 };

  beforeEach(async () => {
    redisClient = { sadd: jest.fn(), expire: jest.fn(), srem: jest.fn() };

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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { getClient: () => redisClient } },
      ],
    }).compile();

    service = module.get(RoomsService);
  });

  describe('createRoom', () => {
    it('always reports PRIVATE_ROOM/CASUAL with ratingEligible false', async () => {
      const result = await service.createRoom(HOST_ID, 2);
      expect(result).toMatchObject({
        type: 'PRIVATE_ROOM',
        mode: 'CASUAL',
        ratingEligible: false,
        ratingMessage: 'Private room matches do not affect rating.',
      });
    });

    it('never persists a ranked/ratingEligible flag - room.create ignores it', async () => {
      await service.createRoom(HOST_ID, 2);
      const createArgs = prisma.room.create.mock.calls[0][0];
      expect(createArgs.data).not.toHaveProperty('ranked');
      expect(createArgs.data).not.toHaveProperty('ratingEligible');
    });

    it('rejects a second room from the same host while one is still active', async () => {
      prisma.room.findFirst.mockResolvedValue(ROOM);
      await expect(service.createRoom(HOST_ID, 2)).rejects.toMatchObject({
        code: 'ROOM_ALREADY_HOSTED',
      });
      expect(prisma.room.create).not.toHaveBeenCalled();
    });

    it('allows a new room once the host has no active room', async () => {
      prisma.room.findFirst.mockResolvedValue(null);
      await expect(service.createRoom(HOST_ID, 2)).resolves.toMatchObject({
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

  describe('listActive', () => {
    it('never selects passwordHash or email for player users', async () => {
      await service.listActive();
      const findManyArgs = prisma.room.findMany.mock.calls[0][0];
      const userSelect = findManyArgs.include.players.include.user;
      expect(userSelect).not.toBe(true);
      expect(userSelect.select).not.toHaveProperty('passwordHash');
      expect(userSelect.select).not.toHaveProperty('email');
    });

    it('tags every listed room as casual', async () => {
      const result = await service.listActive();
      expect(result[0]).toMatchObject({ type: 'PRIVATE_ROOM', mode: 'CASUAL', ratingEligible: false });
    });
  });
});
