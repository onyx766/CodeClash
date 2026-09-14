import { NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { RatingService } from './rating.service';
import { PrismaService } from '../../database/prisma.service';
import { InvalidMatchStateException } from '../../common/exceptions/app.exception';
import { calculateEloChange, calculateEloDrawChange } from './elo.util';

const WINNER_ID = 'winner-1';
const LOSER_ID = 'loser-1';
const MATCH_ID = 'match-1';

function makePrisma() {
  const prisma: any = {
    match: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userStats: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    ratingHistory: { create: jest.fn().mockResolvedValue({}) },
    matchParticipant: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve({ ratingBefore: where.matchId_userId.userId === WINNER_ID ? 1500 : 1400 }),
      ),
    },
    matchChallengeProgress: { count: jest.fn().mockResolvedValue(3) },
  };
  prisma.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(prisma));
  return prisma;
}

function baseMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_ID,
    type: 'PRIVATE_ROOM',
    status: MatchStatus.FINISHED,
    winnerId: WINNER_ID,
    resultType: 'WIN',
    ratingEligible: false,
    ratingReason: 'PRIVATE_ROOM_CASUAL',
    ratingProcessedAt: null,
    participants: [
      { userId: WINNER_ID, ratingBefore: 1500 },
      { userId: LOSER_ID, ratingBefore: 1400 },
    ],
    ...overrides,
  };
}

const stats = (rating: number, extra: Record<string, number> = {}) => ({
  rating,
  wins: 0,
  losses: 0,
  matchesPlayed: 0,
  bestStreak: 0,
  currentStreak: 0,
  ...extra,
});

describe('RatingService', () => {
  let service: RatingService;
  let prisma: any;

  const statsCall = (userId: string) =>
    prisma.userStats.update.mock.calls.find((c: any[]) => c[0].where.userId === userId)?.[0].data;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.userStats.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where.userId === WINNER_ID ? stats(1500, { currentStreak: 2, bestStreak: 2 }) : stats(1400)),
    );
    service = new RatingService(prisma as PrismaService);
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
  ])('refuses a %s match and writes nothing', async (status) => {
    prisma.match.findUnique.mockResolvedValue(baseMatch({ status, ratingEligible: true }));
    await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(InvalidMatchStateException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.userStats.update).not.toHaveBeenCalled();
  });

  it('does not reprocess a match whose rating was already applied', async () => {
    prisma.match.findUnique.mockResolvedValue(baseMatch({ ratingProcessedAt: new Date('2026-01-01') }));

    const result = await service.applyMatchRating(MATCH_ID);

    expect(result).toEqual({ changes: {}, alreadyProcessed: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.userStats.update).not.toHaveBeenCalled();
  });

  it('throws when a WIN has no winner, or the winner is not a participant', async () => {
    prisma.match.findUnique.mockResolvedValue(baseMatch({ winnerId: null }));
    await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(InvalidMatchStateException);

    prisma.match.findUnique.mockResolvedValue(baseMatch({ winnerId: 'someone-else' }));
    await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(InvalidMatchStateException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws when the match does not have exactly two participants', async () => {
    prisma.match.findUnique.mockResolvedValue(baseMatch({ participants: [{ userId: WINNER_ID }] }));
    await expect(service.applyMatchRating(MATCH_ID)).rejects.toBeInstanceOf(InvalidMatchStateException);
  });

  it('applies exactly once when two callers race - the loser of the claim writes nothing', async () => {
    prisma.match.findUnique.mockResolvedValue(baseMatch({ ratingEligible: true }));
    prisma.match.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const [first, second] = await Promise.all([
      service.applyMatchRating(MATCH_ID),
      service.applyMatchRating(MATCH_ID),
    ]);

    expect([first.alreadyProcessed, second.alreadyProcessed].filter(Boolean)).toHaveLength(1);
    expect(prisma.userStats.update).toHaveBeenCalledTimes(2); // one winner + one loser write
    expect(prisma.ratingHistory.create).toHaveBeenCalledTimes(2);
    expect(prisma.match.updateMany).toHaveBeenCalledWith({
      where: { id: MATCH_ID, ratingProcessedAt: null },
      data: { ratingProcessedAt: expect.any(Date) },
    });
  });

  describe('casual (private room) matches', () => {
    it('never changes rating or writes history, and bumps casual stats only', async () => {
      prisma.match.findUnique.mockResolvedValue(baseMatch({ ratingEligible: false }));

      const result = await service.applyMatchRating(MATCH_ID);

      expect(result).toEqual({ changes: { [WINNER_ID]: 0, [LOSER_ID]: 0 } });
      expect(prisma.ratingHistory.create).not.toHaveBeenCalled();
      expect(statsCall(WINNER_ID)).toEqual({ casualWins: { increment: 1 }, casualMatchesPlayed: { increment: 1 } });
      expect(statsCall(LOSER_ID)).toEqual({ casualLosses: { increment: 1 }, casualMatchesPlayed: { increment: 1 } });
      // ratingAfter is the unchanged snapshot.
      expect(prisma.matchParticipant.update).toHaveBeenCalledWith({
        where: { matchId_userId: { matchId: MATCH_ID, userId: WINNER_ID } },
        data: { ratingAfter: 1500 },
      });
    });

    it('records a casual draw without touching rating', async () => {
      prisma.match.findUnique.mockResolvedValue(baseMatch({ resultType: 'DRAW', winnerId: null }));

      const result = await service.applyMatchRating(MATCH_ID);

      expect(result.changes).toEqual({ [WINNER_ID]: 0, [LOSER_ID]: 0 });
      expect(statsCall(WINNER_ID)).toEqual({ casualDraws: { increment: 1 }, casualMatchesPlayed: { increment: 1 } });
      expect(statsCall(LOSER_ID)).toEqual({ casualDraws: { increment: 1 }, casualMatchesPlayed: { increment: 1 } });
      expect(prisma.ratingHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('ranked (Quick Match) matches', () => {
    beforeEach(() => {
      prisma.match.findUnique.mockResolvedValue(baseMatch({ type: 'QUICK_MATCH', ratingEligible: true }));
    });

    it('applies an opposite-signed Elo change and writes both history rows', async () => {
      const result = await service.applyMatchRating(MATCH_ID);

      const change = calculateEloChange(1500, 1400);
      expect(change).toBeGreaterThan(0);
      expect(result.changes).toEqual({ [WINNER_ID]: change, [LOSER_ID]: -change });
      expect(prisma.ratingHistory.create).toHaveBeenCalledTimes(2);
      expect(prisma.matchParticipant.update).toHaveBeenCalledWith({
        where: { matchId_userId: { matchId: MATCH_ID, userId: LOSER_ID } },
        data: { ratingAfter: 1400 - change },
      });
    });

    it('updates ranked wins/losses/streaks, never casual stats', async () => {
      await service.applyMatchRating(MATCH_ID);

      expect(statsCall(WINNER_ID)).toMatchObject({ wins: { increment: 1 }, currentStreak: 3, bestStreak: 3 });
      expect(statsCall(LOSER_ID)).toMatchObject({ losses: { increment: 1 }, currentStreak: 0 });
      expect(statsCall(WINNER_ID).casualWins).toBeUndefined();
    });

    it('moves ratings towards each other on a draw with solves', async () => {
      prisma.match.findUnique.mockResolvedValue(
        baseMatch({ ratingEligible: true, resultType: 'DRAW', winnerId: null }),
      );

      const result = await service.applyMatchRating(MATCH_ID);

      const change = calculateEloDrawChange(1500, 1400);
      expect(change).toBeLessThan(0); // the favourite gives up points
      expect(result.changes).toEqual({ [WINNER_ID]: change, [LOSER_ID]: -change });
      expect(statsCall(WINNER_ID)).toMatchObject({ draws: { increment: 1 }, currentStreak: 0 });
      expect(prisma.ratingHistory.create).toHaveBeenCalledTimes(2);
    });

    it('leaves rating alone for a draw in which nobody solved anything', async () => {
      prisma.match.findUnique.mockResolvedValue(
        baseMatch({ ratingEligible: true, resultType: 'DRAW', winnerId: null }),
      );
      prisma.matchChallengeProgress.count.mockResolvedValue(0);

      const result = await service.applyMatchRating(MATCH_ID);

      expect(result.changes).toEqual({ [WINNER_ID]: 0, [LOSER_ID]: -0 });
      expect(statsCall(WINNER_ID)).toMatchObject({ rating: { increment: 0 }, draws: { increment: 1 } });
      expect(prisma.ratingHistory.create).not.toHaveBeenCalled();
    });

    it('propagates a transaction failure without a partial second attempt', async () => {
      prisma.$transaction.mockRejectedValueOnce(new Error('db connection lost'));
      await expect(service.applyMatchRating(MATCH_ID)).rejects.toThrow('db connection lost');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.userStats.update).not.toHaveBeenCalled();
    });
  });
});
