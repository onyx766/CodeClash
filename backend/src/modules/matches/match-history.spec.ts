import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MatchResultType, MatchType } from '@prisma/client';
import { MatchesService } from './matches.service';
import { PrismaService } from '../../database/prisma.service';
import { MatchSelectionService } from './match-selection.service';
import { SocketGateway } from '../../socket/socket.gateway';

describe('MatchesService.getMatchHistoryForUser', () => {
  let service: MatchesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      matchParticipant: { count: jest.fn(), findMany: jest.fn() },
      ratingHistory: { findMany: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MatchSelectionService, useValue: {} },
        { provide: SocketGateway, useValue: { emitToUser: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(MatchesService);
  });

  it('reports a ranked win with its rating delta and the opponent', async () => {
    prisma.matchParticipant.count.mockResolvedValue(1);
    prisma.matchParticipant.findMany.mockResolvedValue([
      {
        matchId: 'm1',
        userId: 'me',
        ratingBefore: 1200,
        ratingAfter: 1224,
        match: {
          id: 'm1',
          type: MatchType.QUICK_MATCH,
          ratingEligible: true,
          finishedAt: new Date('2024-01-01'),
          resultType: MatchResultType.WIN,
          winnerId: 'me',
          participants: [
            { userId: 'me', user: { id: 'me', username: 'me', profile: null } },
            {
              userId: 'opp',
              user: { id: 'opp', username: 'opp', profile: { displayName: 'Opp', avatarUrl: null } },
            },
          ],
        },
      },
    ]);
    prisma.ratingHistory.findMany.mockResolvedValue([{ matchId: 'm1', change: 24 }]);

    const res = await service.getMatchHistoryForUser('me', 1, 10);

    expect(res.matches).toEqual([
      expect.objectContaining({
        matchId: 'm1',
        result: 'WIN',
        ratingDelta: 24,
        ratingAfter: 1224,
        opponent: expect.objectContaining({ id: 'opp', username: 'opp', displayName: 'Opp' }),
      }),
    ]);
  });

  it('reports no rating delta for a casual (private-room) loss', async () => {
    prisma.matchParticipant.count.mockResolvedValue(1);
    prisma.matchParticipant.findMany.mockResolvedValue([
      {
        matchId: 'm2',
        userId: 'me',
        ratingBefore: 1200,
        ratingAfter: null,
        match: {
          id: 'm2',
          type: MatchType.PRIVATE_ROOM,
          ratingEligible: false,
          finishedAt: new Date('2024-01-02'),
          resultType: null,
          winnerId: 'opp',
          participants: [
            { userId: 'me', user: { id: 'me', username: 'me', profile: null } },
            { userId: 'opp', user: { id: 'opp', username: 'opp', profile: null } },
          ],
        },
      },
    ]);
    // Casual matches never get a RatingHistory row.
    prisma.ratingHistory.findMany.mockResolvedValue([]);

    const res = await service.getMatchHistoryForUser('me', 1, 10);

    expect(res.matches[0]).toEqual(
      expect.objectContaining({ result: 'LOSS', ratingDelta: null, ratingAfter: 1200 }),
    );
  });

  it('caps pageSize and skips the RatingHistory lookup when there are no rows', async () => {
    prisma.matchParticipant.count.mockResolvedValue(0);
    prisma.matchParticipant.findMany.mockResolvedValue([]);

    const res = await service.getMatchHistoryForUser('me', 1, 500);

    expect(prisma.matchParticipant.findMany.mock.calls[0][0].take).toBe(50);
    expect(prisma.ratingHistory.findMany).not.toHaveBeenCalled();
    expect(res.matches).toEqual([]);
  });
});
