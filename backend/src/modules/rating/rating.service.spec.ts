import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { RatingService } from './rating.service';
import { PrismaService } from '../../database/prisma.service';
import { InvalidMatchStateException } from '../../common/exceptions/app.exception';

type MockPrisma = {
  match: { findUnique: jest.Mock; update: jest.Mock };
  userStats: { findUnique: jest.Mock; update: jest.Mock };
  ratingHistory: { create: jest.Mock };
  $transaction: jest.Mock;
};

describe('RatingService', () => {
  let service: RatingService;
  let prisma: MockPrisma;

  const WINNER_ID = 'winner-1';
  const LOSER_ID = 'loser-1';
  const MATCH_ID = 'match-1';

  function baseMatch(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: MATCH_ID,
      type: 'PRIVATE_ROOM',
      status: MatchStatus.FINISHED,
      winnerId: WINNER_ID,
      ratingEligible: false,
      ratingReason: 'PRIVATE_ROOM_CASUAL',
      ratingProcessedAt: null,
      room: { players: [{ userId: WINNER_ID }, { userId: LOSER_ID }] },
      participants: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      match: { findUnique: jest.fn(), update: jest.fn() },
      userStats: { findUnique: jest.fn(), update: jest.fn() },
      ratingHistory: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RatingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(RatingService);
  });

  it('throws NotFoundException when the match does not exist', async () => {
    prisma.match.findUnique.mockResolvedValue(null);
    await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    MatchStatus.PENDING,
    MatchStatus.IN_PROGRESS,
    MatchStatus.CANCELLED,
    MatchStatus.ABANDONED,
    MatchStatus.EXPIRED,
  ])('throws InvalidMatchStateException and applies no writes for status %s', async (status) => {
    prisma.match.findUnique.mockResolvedValue(baseMatch({ status }));
    await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(
      InvalidMatchStateException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.userStats.update).not.toHaveBeenCalled();
  });

  it('does not reprocess a match whose rating was already applied', async () => {
    prisma.match.findUnique.mockResolvedValue(
      baseMatch({ ratingProcessedAt: new Date('2026-01-01') }),
    );

    const result = await service.applyMatchRating(MATCH_ID);

    expect(result).toEqual({ winnerChange: 0, loserChange: 0, alreadyProcessed: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.userStats.update).not.toHaveBeenCalled();
    expect(prisma.ratingHistory.create).not.toHaveBeenCalled();
  });

  it('throws when the match has no winner recorded', async () => {
    prisma.match.findUnique.mockResolvedValue(baseMatch({ winnerId: null }));
    await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(
      InvalidMatchStateException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws when a second player cannot be found', async () => {
    prisma.match.findUnique.mockResolvedValue(
      baseMatch({ room: { players: [{ userId: WINNER_ID }] } }),
    );
    await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(
      InvalidMatchStateException,
    );
  });

  describe('casual (private room) matches', () => {
    beforeEach(() => {
      prisma.match.findUnique.mockResolvedValue(baseMatch({ ratingEligible: false }));
    });

    it('gives the winner and loser zero rating change', async () => {
      const result = await service.applyMatchRating(MATCH_ID);
      expect(result).toEqual({ winnerChange: 0, loserChange: 0 });
    });

    it('creates no RatingHistory rows', async () => {
      await service.applyMatchRating(MATCH_ID);
      expect(prisma.ratingHistory.create).not.toHaveBeenCalled();
    });

    it('bumps casual stats only, never ranked wins/losses', async () => {
      await service.applyMatchRating(MATCH_ID);

      const winnerCall = prisma.userStats.update.mock.calls.find(
        (c) => c[0].where.userId === WINNER_ID,
      );
      const loserCall = prisma.userStats.update.mock.calls.find(
        (c) => c[0].where.userId === LOSER_ID,
      );

      expect(winnerCall[0].data).toEqual({
        casualWins: { increment: 1 },
        casualMatchesPlayed: { increment: 1 },
      });
      expect(loserCall[0].data).toEqual({
        casualLosses: { increment: 1 },
        casualMatchesPlayed: { increment: 1 },
      });
    });

    it('stamps ratingProcessedAt via the same transaction', async () => {
      await service.applyMatchRating(MATCH_ID);
      const matchUpdateCall = prisma.match.update.mock.calls[0][0];
      expect(matchUpdateCall.where).toEqual({ id: MATCH_ID });
      expect(matchUpdateCall.data.ratingProcessedAt).toBeInstanceOf(Date);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('ranked (Quick Match) matches', () => {
    beforeEach(() => {
      prisma.match.findUnique.mockResolvedValue(baseMatch({ ratingEligible: true }));
      prisma.userStats.findUnique.mockImplementation(({ where: { userId } }) => {
        if (userId === WINNER_ID) {
          return Promise.resolve({ rating: 1200, wins: 0, losses: 0, matchesPlayed: 0, bestStreak: 0, currentStreak: 0 });
        }
        return Promise.resolve({ rating: 1200, wins: 0, losses: 0, matchesPlayed: 0, bestStreak: 0, currentStreak: 0 });
      });
    });

    it('is rating eligible and produces a nonzero, opposite-signed change', async () => {
      const result = await service.applyMatchRating(MATCH_ID);
      expect(result.winnerChange).toBeGreaterThan(0);
      expect(result.loserChange).toBe(-result.winnerChange);
    });

    it('creates a RatingHistory row for both winner and loser', async () => {
      await service.applyMatchRating(MATCH_ID);
      expect(prisma.ratingHistory.create).toHaveBeenCalledTimes(2);
      const userIds = prisma.ratingHistory.create.mock.calls.map((c) => c[0].data.userId);
      expect(userIds.sort()).toEqual([LOSER_ID, WINNER_ID].sort());
    });

    it('updates ranked wins/losses, not casual stats', async () => {
      await service.applyMatchRating(MATCH_ID);
      const winnerCall = prisma.userStats.update.mock.calls.find(
        (c) => c[0].where.userId === WINNER_ID,
      );
      const loserCall = prisma.userStats.update.mock.calls.find(
        (c) => c[0].where.userId === LOSER_ID,
      );
      expect(winnerCall[0].data.wins).toEqual({ increment: 1 });
      expect(loserCall[0].data.losses).toEqual({ increment: 1 });
      expect(winnerCall[0].data.casualWins).toBeUndefined();
    });

    it('bundles every write into a single atomic transaction', async () => {
      await service.applyMatchRating(MATCH_ID);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = prisma.$transaction.mock.calls[0][0];
      expect(ops).toHaveLength(5); // winner update, loser update, 2 history rows, match update
    });

    it('propagates a transaction failure without a second, partial attempt', async () => {
      prisma.$transaction.mockRejectedValueOnce(new Error('db connection lost'));
      await expect(service.applyMatchRating(MATCH_ID)).rejects.toThrow('db connection lost');
      // The one failed transaction call is the only attempt - no fallback
      // logic re-applies part of the update outside the transaction.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.match.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('Quick Match (no Room - MatchParticipant instead)', () => {
    beforeEach(() => {
      prisma.match.findUnique.mockResolvedValue(
        baseMatch({
          type: 'QUICK_MATCH',
          ratingEligible: true,
          ratingReason: null,
          room: null,
          participants: [{ userId: WINNER_ID }, { userId: LOSER_ID }],
        }),
      );
      prisma.userStats.findUnique.mockResolvedValue({
        rating: 1200,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        bestStreak: 0,
        currentStreak: 0,
      });
    });

    it('derives winner/loser from MatchParticipant, not room.players, and still applies Elo', async () => {
      const result = await service.applyMatchRating(MATCH_ID);
      expect(result.winnerChange).toBeGreaterThan(0);
      expect(result.loserChange).toBe(-result.winnerChange);
    });

    it('throws when a second participant cannot be found', async () => {
      prisma.match.findUnique.mockResolvedValue(
        baseMatch({
          type: 'QUICK_MATCH',
          ratingEligible: true,
          room: null,
          participants: [{ userId: WINNER_ID }],
        }),
      );
      await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(
        InvalidMatchStateException,
      );
    });
  });
});
