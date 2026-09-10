import { Test, TestingModule } from '@nestjs/testing';
import { MatchStatus, MatchType } from '@prisma/client';
import { MatchProgressionService } from './match-progression.service';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { RatingService } from '../rating/rating.service';
import { SocketEvents } from '../../socket/socket.events';

type MockPrisma = {
  round: { findUnique: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock };
  match: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
};

const MATCH_ID = 'match-1';
const ROUND_ID = 'round-1';
const P1 = 'player-1';
const P2 = 'player-2';

describe('MatchProgressionService', () => {
  let service: MatchProgressionService;
  let prisma: MockPrisma;
  let socket: { emitToUser: jest.Mock };
  let rating: { applyMatchRating: jest.Mock };

  /** A Quick Match round with whatever submissions the test supplies. */
  function roundWith(
    submissions: { userId: string; score: number; submittedAt: Date }[],
    overrides: Record<string, any> = {},
  ) {
    return {
      id: ROUND_ID,
      matchId: MATCH_ID,
      roundNumber: 1,
      startedAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 60_000),
      finishedAt: null,
      winnerId: null,
      challengeId: 'challenge-1',
      challenge: { id: 'challenge-1', title: 'Two Sum', timeLimitSeconds: 300 },
      submissions: submissions.map((s, i) => ({
        id: `sub-${i}`,
        passedTests: 1,
        totalTests: 1,
        runtimeMs: 5,
        ...s,
      })),
      match: {
        id: MATCH_ID,
        type: MatchType.QUICK_MATCH,
        status: MatchStatus.IN_PROGRESS,
        totalRounds: 3,
        participants: [{ userId: P1 }, { userId: P2 }],
        room: null,
      },
      ...overrides,
    };
  }

  /** Match-level view used by advanceAfterRound. */
  function matchWith(rounds: any[], overrides: Record<string, any> = {}) {
    return {
      id: MATCH_ID,
      type: MatchType.QUICK_MATCH,
      status: MatchStatus.IN_PROGRESS,
      totalRounds: 3,
      ratingEligible: true,
      participants: [{ userId: P1 }, { userId: P2 }],
      room: null,
      rounds,
      ...overrides,
    };
  }

  function closedRound(roundNumber: number, winnerId: string | null, subs: any[] = []) {
    return {
      id: `round-${roundNumber}`,
      roundNumber,
      finishedAt: new Date(),
      winnerId,
      submissions: subs,
    };
  }

  beforeEach(async () => {
    prisma = {
      round: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      match: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    socket = { emitToUser: jest.fn() };
    rating = { applyMatchRating: jest.fn().mockResolvedValue({ winnerChange: 12, loserChange: -12 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchProgressionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SocketGateway, useValue: socket },
        { provide: RatingService, useValue: rating },
      ],
    }).compile();

    service = module.get(MatchProgressionService);
  });

  describe('maybeCloseRound', () => {
    it('does nothing while only one player has submitted and time remains', async () => {
      prisma.round.findUnique.mockResolvedValue(
        roundWith([{ userId: P1, score: 700, submittedAt: new Date() }]),
      );

      await service.maybeCloseRound(ROUND_ID);

      expect(prisma.round.updateMany).not.toHaveBeenCalled();
    });

    it('closes the round once both players have submitted', async () => {
      const round = roundWith([
        { userId: P1, score: 700, submittedAt: new Date() },
        { userId: P2, score: 350, submittedAt: new Date() },
      ]);
      prisma.round.findUnique.mockResolvedValue(round);
      prisma.match.findUnique.mockResolvedValue(
        matchWith([closedRound(1, P1)]),
      );
      prisma.round.findFirst.mockResolvedValue({
        id: 'round-2',
        roundNumber: 2,
        challengeId: 'c2',
        challenge: { timeLimitSeconds: 300 },
      });

      await service.maybeCloseRound(ROUND_ID);

      expect(prisma.round.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ROUND_ID, finishedAt: null },
          data: expect.objectContaining({ winnerId: P1 }),
        }),
      );
    });

    it('closes the round on the deadline even if nobody submitted', async () => {
      prisma.round.findUnique.mockResolvedValue(
        roundWith([], { endsAt: new Date(Date.now() - 1000) }),
      );
      prisma.match.findUnique.mockResolvedValue(matchWith([closedRound(1, null)]));
      prisma.round.findFirst.mockResolvedValue({
        id: 'round-2',
        roundNumber: 2,
        challengeId: 'c2',
        challenge: { timeLimitSeconds: 300 },
      });

      await service.maybeCloseRound(ROUND_ID);

      expect(prisma.round.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ winnerId: null }) }),
      );
    });

    it('ignores an already-finished round', async () => {
      prisma.round.findUnique.mockResolvedValue(
        roundWith([], { finishedAt: new Date() }),
      );
      await service.maybeCloseRound(ROUND_ID);
      expect(prisma.round.updateMany).not.toHaveBeenCalled();
    });

    it('ignores a round whose match is no longer in progress', async () => {
      const round = roundWith([
        { userId: P1, score: 700, submittedAt: new Date() },
        { userId: P2, score: 350, submittedAt: new Date() },
      ]);
      round.match.status = MatchStatus.CANCELLED;
      prisma.round.findUnique.mockResolvedValue(round);

      await service.maybeCloseRound(ROUND_ID);

      expect(prisma.round.updateMany).not.toHaveBeenCalled();
    });

    it('stops when another caller won the close claim', async () => {
      prisma.round.findUnique.mockResolvedValue(
        roundWith([
          { userId: P1, score: 700, submittedAt: new Date() },
          { userId: P2, score: 350, submittedAt: new Date() },
        ]),
      );
      prisma.round.updateMany.mockResolvedValue({ count: 0 });

      await service.maybeCloseRound(ROUND_ID);

      // No round:end emitted and no advance attempted - the winning caller
      // does all of that exactly once.
      expect(socket.emitToUser).not.toHaveBeenCalled();
      expect(prisma.match.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('round winner', () => {
    async function closeWith(subs: { userId: string; score: number; submittedAt: Date }[]) {
      prisma.round.findUnique.mockResolvedValue(
        roundWith(subs, { endsAt: new Date(Date.now() - 1) }),
      );
      prisma.match.findUnique.mockResolvedValue(matchWith([closedRound(1, null)]));
      prisma.round.findFirst.mockResolvedValue({
        id: 'round-2',
        roundNumber: 2,
        challengeId: 'c2',
        challenge: { timeLimitSeconds: 300 },
      });
      await service.maybeCloseRound(ROUND_ID);
      return prisma.round.updateMany.mock.calls[0][0].data.winnerId;
    }

    it('awards the round to the higher score', async () => {
      const now = new Date();
      expect(
        await closeWith([
          { userId: P1, score: 300, submittedAt: now },
          { userId: P2, score: 700, submittedAt: now },
        ]),
      ).toBe(P2);
    });

    it('breaks an equal score by the earlier submission', async () => {
      expect(
        await closeWith([
          { userId: P1, score: 700, submittedAt: new Date(2_000) },
          { userId: P2, score: 700, submittedAt: new Date(1_000) },
        ]),
      ).toBe(P2);
    });

    it('awards the round to the only player who submitted', async () => {
      expect(
        await closeWith([{ userId: P2, score: 0, submittedAt: new Date() }]),
      ).toBe(P2);
    });

    it('is a draw when neither player submitted', async () => {
      expect(await closeWith([])).toBeNull();
    });
  });

  describe('match completion', () => {
    it('ends the match early when a player reaches the majority of rounds', async () => {
      prisma.round.findUnique.mockResolvedValue(
        roundWith(
          [
            { userId: P1, score: 700, submittedAt: new Date() },
            { userId: P2, score: 100, submittedAt: new Date() },
          ],
          { roundNumber: 2 },
        ),
      );
      // P1 has now won rounds 1 and 2 of a best-of-3.
      prisma.match.findUnique.mockResolvedValue(
        matchWith([closedRound(1, P1), closedRound(2, P1)]),
      );

      await service.maybeCloseRound(ROUND_ID);

      expect(prisma.match.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MATCH_ID, status: MatchStatus.IN_PROGRESS },
          data: expect.objectContaining({
            status: MatchStatus.FINISHED,
            winnerId: P1,
          }),
        }),
      );
      // Round 3 must not be scheduled once the match is already decided.
      expect(prisma.round.findFirst).not.toHaveBeenCalled();
    });

    it('starts the next round when the match is still undecided', async () => {
      prisma.round.findUnique.mockResolvedValue(
        roundWith([
          { userId: P1, score: 700, submittedAt: new Date() },
          { userId: P2, score: 100, submittedAt: new Date() },
        ]),
      );
      prisma.match.findUnique.mockResolvedValue(matchWith([closedRound(1, P1)]));
      prisma.round.findFirst.mockResolvedValue({
        id: 'round-2',
        roundNumber: 2,
        challengeId: 'c2',
        challenge: { timeLimitSeconds: 300 },
      });

      await service.maybeCloseRound(ROUND_ID);

      expect(prisma.match.updateMany).not.toHaveBeenCalled();
      // Round 2 gets its deadline now, not at match start.
      expect(prisma.round.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'round-2', startedAt: null, finishedAt: null },
          data: expect.objectContaining({ startedAt: expect.any(Date), endsAt: expect.any(Date) }),
        }),
      );
      expect(prisma.match.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentRoundNumber: 2 } }),
      );
    });

    it('decides a level match on total score after the final round', async () => {
      prisma.round.findUnique.mockResolvedValue(
        roundWith([], { roundNumber: 3, endsAt: new Date(Date.now() - 1) }),
      );
      prisma.match.findUnique.mockResolvedValue(
        matchWith([
          closedRound(1, P1, [{ userId: P1, score: 700, submittedAt: new Date(1000) }]),
          closedRound(2, P2, [{ userId: P2, score: 100, submittedAt: new Date(2000) }]),
          closedRound(3, null, []),
        ]),
      );

      await service.maybeCloseRound(ROUND_ID);

      expect(prisma.match.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: MatchStatus.FINISHED, winnerId: P1 }),
        }),
      );
    });

    it('cancels rather than finishes a match nobody ever played', async () => {
      prisma.round.findUnique.mockResolvedValue(
        roundWith([], { roundNumber: 3, endsAt: new Date(Date.now() - 1) }),
      );
      prisma.match.findUnique.mockResolvedValue(
        matchWith([closedRound(1, null), closedRound(2, null), closedRound(3, null)]),
      );

      await service.maybeCloseRound(ROUND_ID);

      expect(prisma.match.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: MatchStatus.CANCELLED }),
        }),
      );
      // An unplayed match must never reach the rating system.
      expect(rating.applyMatchRating).not.toHaveBeenCalled();
    });
  });

  describe('finishMatch', () => {
    beforeEach(() => {
      prisma.match.findUnique.mockResolvedValue(
        matchWith([closedRound(1, P1), closedRound(2, P1)], {
          rounds: [
            { roundNumber: 1, winnerId: P1 },
            { roundNumber: 2, winnerId: P1 },
          ],
        }),
      );
    });

    it('applies rating after the result is committed', async () => {
      await service.finishMatch(MATCH_ID, P1);

      expect(prisma.match.updateMany).toHaveBeenCalled();
      expect(rating.applyMatchRating).toHaveBeenCalledWith(MATCH_ID);
    });

    it('tells each player their own rating change', async () => {
      await service.finishMatch(MATCH_ID, P1);

      const events = socket.emitToUser.mock.calls.filter(
        ([, event]) => event === SocketEvents.MATCH_END,
      );
      expect(events).toHaveLength(2);
      expect(events.find(([userId]) => userId === P1)?.[2]).toMatchObject({
        won: true,
        ratingChange: 12,
      });
      expect(events.find(([userId]) => userId === P2)?.[2]).toMatchObject({
        won: false,
        ratingChange: -12,
      });
    });

    it('does nothing when the match was already finished by another caller', async () => {
      prisma.match.updateMany.mockResolvedValue({ count: 0 });

      await service.finishMatch(MATCH_ID, P1);

      expect(rating.applyMatchRating).not.toHaveBeenCalled();
      expect(socket.emitToUser).not.toHaveBeenCalled();
    });

    it('keeps the committed result when rating fails, leaving it to be retried', async () => {
      rating.applyMatchRating.mockRejectedValue(new Error('db down'));

      await expect(service.finishMatch(MATCH_ID, P1)).resolves.toBeUndefined();

      const events = socket.emitToUser.mock.calls.filter(
        ([, event]) => event === SocketEvents.MATCH_END,
      );
      expect(events).toHaveLength(2);
      expect(events[0][2]).toMatchObject({ ratingChange: null });
    });
  });
});
