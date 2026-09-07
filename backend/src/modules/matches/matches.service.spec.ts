import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { MatchesService } from './matches.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SocketGateway } from '../../socket/socket.gateway';

type MockPrisma = {
  room: { findUnique: jest.Mock };
  challenge: { findMany: jest.Mock };
  match: { create: jest.Mock; update: jest.Mock };
  round: { create: jest.Mock };
};

describe('MatchesService', () => {
  let service: MatchesService;
  let prisma: MockPrisma;
  let redisClient: { hgetall: jest.Mock };

  const ROOM_ID = 'room-1';
  const HOST_ID = 'host-1';
  const GUEST_ID = 'guest-1';

  function room(hostRole: Role = Role.USER) {
    return {
      id: ROOM_ID,
      hostId: HOST_ID,
      players: [
        { userId: HOST_ID, role: hostRole },
        { userId: GUEST_ID, role: Role.USER },
      ],
    };
  }

  const challenges = [
    { id: 'c1', timeLimitSeconds: 300 },
    { id: 'c2', timeLimitSeconds: 300 },
    { id: 'c3', timeLimitSeconds: 300 },
  ];

  beforeEach(async () => {
    redisClient = { hgetall: jest.fn().mockResolvedValue({ [HOST_ID]: '1', [GUEST_ID]: '1' }) };

    prisma = {
      room: { findUnique: jest.fn().mockResolvedValue(room()) },
      challenge: { findMany: jest.fn().mockResolvedValue(challenges) },
      match: {
        create: jest.fn().mockResolvedValue({ id: 'match-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      round: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { getClient: () => redisClient } },
        {
          provide: SocketGateway,
          useValue: { server: { to: () => ({ emit: jest.fn() }) } },
        },
      ],
    }).compile();

    service = module.get(MatchesService);
  });

  it('always creates the match as PRIVATE_ROOM and not rating eligible', async () => {
    await service.startMatch(ROOM_ID, HOST_ID);

    expect(prisma.match.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId: ROOM_ID,
        type: 'PRIVATE_ROOM',
        ratingEligible: false,
        ratingReason: 'PRIVATE_ROOM_CASUAL',
      }),
    });
  });

  it('stays PRIVATE_ROOM/casual even when the host is ADMIN', async () => {
    prisma.room.findUnique.mockResolvedValue(room(Role.ADMIN));
    await service.startMatch(ROOM_ID, HOST_ID);
    expect(prisma.match.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'PRIVATE_ROOM', ratingEligible: false }),
    });
  });

  it('stays PRIVATE_ROOM/casual even when the host is MASTER', async () => {
    prisma.room.findUnique.mockResolvedValue(room(Role.MASTER));
    await service.startMatch(ROOM_ID, HOST_ID);
    expect(prisma.match.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'PRIVATE_ROOM', ratingEligible: false }),
    });
  });
});
