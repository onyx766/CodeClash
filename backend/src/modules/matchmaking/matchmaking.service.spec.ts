import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { MatchesService } from '../matches/matches.service';
import { FakeRedis } from './matchmaking.test-utils';
import { MatchmakingStatus } from './matchmaking.types';
import {
  ActiveMatchExistsException,
  ActiveRoomExistsException,
  InvalidMatchStateException,
  MatchAlreadyFoundException,
  MatchmakingUnavailableException,
  UserStatsNotFoundException,
} from '../../common/exceptions/app.exception';
import {
  MATCHMAKING_JOINED_ZSET,
  MATCHMAKING_RATING_ZSET,
} from './matchmaking.constants';

type MockPrisma = {
  matchParticipant: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    createMany: jest.Mock;
  };
  userStats: { findUnique: jest.Mock };
  match: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  user: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  return {
    matchParticipant: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    userStats: { findUnique: jest.fn() },
    match: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((cb) => cb(prismaTxHandle)),
  };
}

// The $transaction mock above needs a `tx` handle to call back into - reuse
// the same mock object (mirrors the RatingService/MatchesService spec style).
let prismaTxHandle: MockPrisma;

async function buildService(overrides?: { config?: Record<string, number> }) {
  const prisma = makePrisma();
  prismaTxHandle = prisma;
  const redis = new FakeRedis();
  const rooms = { findActiveRoomForUser: jest.fn().mockResolvedValue(null) };
  const matches = {
    startQuickMatch: jest.fn().mockResolvedValue({ id: 'match-1', status: 'IN_PROGRESS' }),
  };
  const emit = jest.fn();
  const socket = { server: { to: () => ({ emit }) } };
  const configValues: Record<string, number> = overrides?.config ?? {};
  const config = { get: jest.fn((key: string) => configValues[key]) };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MatchmakingService,
      { provide: PrismaService, useValue: prisma },
      { provide: RedisService, useValue: { getClient: () => redis } },
      { provide: RoomsService, useValue: rooms },
      { provide: SocketGateway, useValue: socket },
      { provide: MatchesService, useValue: matches },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();

  const service = module.get(MatchmakingService);
  return { service, prisma, redis, rooms, matches, emit };
}

describe('MatchmakingService', () => {
  describe('startSearch', () => {
    it('uses the DB rating, never a client-supplied one', async () => {
      const { service, prisma } = await buildService();
      prisma.userStats.findUnique.mockResolvedValue({ rating: 1730 });

      const state = await service.startSearch('u1');

      expect(state).toMatchObject({ status: MatchmakingStatus.SEARCHING, rating: 1730 });
    });

    it('is idempotent - a second call while searching does not duplicate the queue entry', async () => {
      const { service, redis, prisma } = await buildService();
      prisma.userStats.findUnique.mockResolvedValue({ rating: 1500 });

      await service.startSearch('u1');
      await service.startSearch('u1');

      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'u1')).toBe('1500');
      const members = await redis.zrange(MATCHMAKING_RATING_ZSET, 0, -1);
      expect(members.filter((m) => m === 'u1')).toHaveLength(1);
    });

    it('rejects when the user already has an active private room', async () => {
      const { service, rooms, prisma } = await buildService();
      prisma.userStats.findUnique.mockResolvedValue({ rating: 1200 });
      rooms.findActiveRoomForUser.mockResolvedValue({ id: 'room-1' });

      await expect(service.startSearch('u1')).rejects.toBeInstanceOf(ActiveRoomExistsException);
    });

    it('rejects when the user already has an active Quick Match', async () => {
      const { service, prisma } = await buildService();
      prisma.userStats.findUnique.mockResolvedValue({ rating: 1200 });
      prisma.matchParticipant.findFirst.mockResolvedValue({ matchId: 'match-1' });

      await expect(service.startSearch('u1')).rejects.toBeInstanceOf(ActiveMatchExistsException);
    });

    it('throws when the user has no UserStats row', async () => {
      const { service, prisma } = await buildService();
      prisma.userStats.findUnique.mockResolvedValue(null);

      await expect(service.startSearch('u1')).rejects.toBeInstanceOf(UserStatsNotFoundException);
    });

    it('returns 503 MATCHMAKING_UNAVAILABLE when Redis fails, with no in-memory fallback', async () => {
      const { service, redis, prisma } = await buildService();
      prisma.userStats.findUnique.mockResolvedValue({ rating: 1200 });
      jest.spyOn(redis, 'zscore').mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.startSearch('u1')).rejects.toBeInstanceOf(MatchmakingUnavailableException);
    });

    it('pairs two compatible searchers immediately, without waiting for a worker tick', async () => {
      const { service, prisma } = await buildService();
      prisma.userStats.findUnique
        .mockResolvedValueOnce({ rating: 1500 })
        .mockResolvedValueOnce({ rating: 1520 });
      prisma.match.create.mockResolvedValue({ id: 'match-1', readyDeadline: new Date() });

      await service.startSearch('alice');
      const second = await service.startSearch('bob');

      expect(second).toEqual({ status: MatchmakingStatus.MATCHED, matchId: 'match-1' });
    });
  });

  describe('candidate selection', () => {
    it('prefers the nearest rating, then the longest-waiting player on ties', async () => {
      const { service, redis } = await buildService();
      const now = Date.now();
      // Tyler: 1850. Alex: 1830 (diff 20, waited 4s). Mike: 1880 (diff 30, waited 20s).
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1850, 'tyler');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now - 1000, 'tyler');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1830, 'alex');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now - 4000, 'alex');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1880, 'mike');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now - 20000, 'mike');

      const service2 = service as unknown as { createMatchFromPair: (a: unknown, b: unknown) => Promise<unknown> };
      const spy = jest.spyOn(service2, 'createMatchFromPair').mockResolvedValue(null);

      await service.attemptMatch('tyler');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'tyler' }),
        expect.objectContaining({ userId: 'alex' }),
      );
    });

    it('breaks a tied rating difference by preferring whoever has waited longer', async () => {
      const { service, redis } = await buildService();
      const now = Date.now();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'me');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now - 1000, 'me');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1520, 'newer');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now - 2000, 'newer');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1480, 'older');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now - 30000, 'older');

      const service2 = service as unknown as { createMatchFromPair: (a: unknown, b: unknown) => Promise<unknown> };
      const spy = jest.spyOn(service2, 'createMatchFromPair').mockResolvedValue(null);

      await service.attemptMatch('me');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'me' }),
        expect.objectContaining({ userId: 'older' }),
      );
    });

    it('never matches a user with themself, even if the queue only contains that user', async () => {
      const { service, redis } = await buildService();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'solo');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, Date.now(), 'solo');

      const result = await service.attemptMatch('solo');

      expect(result).toBeNull();
    });

    it('returns null (still queued) when no one is in the queue', async () => {
      const { service } = await buildService();
      const result = await service.attemptMatch('nobody-queued');
      expect(result).toBeNull();
    });
  });

  describe('atomic claim / concurrency', () => {
    it('claims exactly one Match when two concurrent attempts overlap on a shared candidate', async () => {
      // Tyler, Alex, Sarah are all mutually compatible. Two concurrent
      // attemptMatch calls (Tyler's and Sarah's) both end up trying to claim
      // a pair that includes each other or Alex - whichever pair's atomic
      // claim wins first necessarily removes two of the three users, so the
      // losing attempt's fallback candidate(s) are also gone. Which specific
      // pair forms depends on race timing, but exactly one pair must form,
      // and no user may ever appear in two successful claims (Alex must
      // never end up in both a Tyler match and a Sarah match).
      const { service, redis, prisma } = await buildService();
      const now = Date.now();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'tyler');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now, 'tyler');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'alex');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now, 'alex');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'sarah');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now, 'sarah');

      let created = 0;
      prisma.match.create.mockImplementation(() =>
        Promise.resolve({ id: `match-${++created}`, readyDeadline: new Date() }),
      );

      const [tylerResult, sarahResult] = await Promise.all([
        service.attemptMatch('tyler'),
        service.attemptMatch('sarah'),
      ]);

      const matches = [tylerResult, sarahResult].filter(Boolean);
      expect(matches).toHaveLength(1);
      expect(prisma.matchParticipant.createMany).toHaveBeenCalledTimes(1);

      const pairedUserIds: string[] = prisma.matchParticipant.createMany.mock.calls[0][0].data.map(
        (p: { userId: string }) => p.userId,
      );
      expect(new Set(pairedUserIds).size).toBe(2); // never the same user twice
      expect(pairedUserIds.every((id) => ['tyler', 'alex', 'sarah'].includes(id))).toBe(true);
    });
  });

  describe('match creation', () => {
    it('creates the match as QUICK_MATCH / ratingEligible: true, snapshotting each rating', async () => {
      const { service, redis, prisma } = await buildService();
      const now = Date.now();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'a');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now, 'a');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1510, 'b');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now, 'b');
      prisma.match.create.mockResolvedValue({ id: 'match-1', readyDeadline: new Date() });

      await service.attemptMatch('a');

      expect(prisma.match.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'QUICK_MATCH', ratingEligible: true, status: 'PENDING_READY' }),
      });
      expect(prisma.matchParticipant.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'a', ratingBefore: 1500 }),
          expect.objectContaining({ userId: 'b', ratingBefore: 1510 }),
        ]),
      });
    });

    it('removes both users from the queue once paired', async () => {
      const { service, redis, prisma } = await buildService();
      const now = Date.now();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'a');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now, 'a');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1510, 'b');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, now, 'b');
      prisma.match.create.mockResolvedValue({ id: 'match-1', readyDeadline: new Date() });

      await service.attemptMatch('a');

      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'a')).toBeNull();
      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'b')).toBeNull();
    });

    it('requeues both users, preserving original joinedAt, when Postgres match creation fails', async () => {
      const { service, redis, prisma } = await buildService();
      const joinedA = Date.now() - 5000;
      const joinedB = Date.now() - 1000;
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'a');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, joinedA, 'a');
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1510, 'b');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, joinedB, 'b');
      prisma.$transaction.mockRejectedValueOnce(new Error('db down'));

      const result = await service.attemptMatch('a');

      expect(result).toBeNull();
      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'a')).toBe('1500');
      expect(await redis.zscore(MATCHMAKING_JOINED_ZSET, 'a')).toBe(String(joinedA));
      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'b')).toBe('1510');
      expect(await redis.zscore(MATCHMAKING_JOINED_ZSET, 'b')).toBe(String(joinedB));
    });
  });

  describe('cancelSearch', () => {
    it('removes a searching user and reports IDLE', async () => {
      const { service, redis } = await buildService();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'u1');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, Date.now(), 'u1');

      const result = await service.cancelSearch('u1');

      expect(result).toEqual({ status: MatchmakingStatus.IDLE });
      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'u1')).toBeNull();
    });

    it('is idempotent when nothing was queued', async () => {
      const { service } = await buildService();
      const result = await service.cancelSearch('never-queued');
      expect(result).toEqual({ status: MatchmakingStatus.IDLE });
    });

    it('refuses to cancel (409) once a Match already exists, without destroying it', async () => {
      const { service, prisma } = await buildService();
      prisma.matchParticipant.findFirst.mockResolvedValue({ matchId: 'match-1' });

      await expect(service.cancelSearch('u1')).rejects.toMatchObject({
        code: 'MATCH_ALREADY_FOUND',
      });
    });

    it('refuses to cancel (409) during the brief claim-to-Postgres-commit window', async () => {
      const { service, redis } = await buildService();
      await redis.set('matchmaking:quick:reservation:u1', 'opponent-1', 'EX', 20);

      await expect(service.cancelSearch('u1')).rejects.toBeInstanceOf(MatchAlreadyFoundException);
    });
  });

  describe('getStatus', () => {
    it('returns IDLE when neither queued nor matched', async () => {
      const { service } = await buildService();
      expect(await service.getStatus('u1')).toEqual({ status: MatchmakingStatus.IDLE });
    });

    it('returns SEARCHING with the current rating range when queued', async () => {
      const { service, redis } = await buildService();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'u1');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, Date.now(), 'u1');

      const status = await service.getStatus('u1');

      expect(status).toMatchObject({ status: MatchmakingStatus.SEARCHING, rating: 1500 });
    });

    it('returns MATCHED with the matchId once a Match exists, even if Redis has no trace left', async () => {
      const { service, prisma } = await buildService();
      prisma.matchParticipant.findFirst.mockResolvedValue({ matchId: 'match-1' });

      expect(await service.getStatus('u1')).toEqual({ status: MatchmakingStatus.MATCHED, matchId: 'match-1' });
    });
  });

  describe('handleReady', () => {
    function match(overrides: Record<string, unknown> = {}) {
      return {
        id: 'match-1',
        type: 'QUICK_MATCH',
        status: 'PENDING_READY',
        participants: [
          { matchId: 'match-1', userId: 'a', readyAt: null },
          { matchId: 'match-1', userId: 'b', readyAt: null },
        ],
        ...overrides,
      };
    }

    it('rejects a user who is not a participant in the match', async () => {
      const { service, prisma } = await buildService();
      prisma.match.findUnique.mockResolvedValue(match());

      await expect(service.handleReady('match-1', 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['IN_PROGRESS', 'CANCELLED', 'FINISHED'])(
      'refuses a %s match with 409 INVALID_MATCH_STATE and a message about the ready check',
      async (status) => {
        const { service, prisma } = await buildService();
        prisma.match.findUnique.mockResolvedValue(match({ status }));

        const error = await service.handleReady('match-1', 'a').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(InvalidMatchStateException);
        expect((error as InvalidMatchStateException).getStatus()).toBe(409);
        expect((error as InvalidMatchStateException).getResponse()).toEqual({
          code: 'INVALID_MATCH_STATE',
          message: 'This match is no longer waiting for players to accept.',
        });
        expect(prisma.matchParticipant.update).not.toHaveBeenCalled();
      },
    );

    it('does not start the match when only one participant is ready', async () => {
      const { service, prisma, matches } = await buildService();
      prisma.match.findUnique.mockResolvedValue(match());
      prisma.matchParticipant.findMany.mockResolvedValue([
        { matchId: 'match-1', userId: 'a', readyAt: new Date() },
        { matchId: 'match-1', userId: 'b', readyAt: null },
      ]);

      const result = await service.handleReady('match-1', 'a');

      expect(result).toEqual({ matchId: 'match-1', status: 'PENDING_READY' });
      expect(prisma.match.updateMany).not.toHaveBeenCalled();
      expect(matches.startQuickMatch).not.toHaveBeenCalled();
    });

    it('is idempotent - re-readying an already-ready participant does not re-write it', async () => {
      const { service, prisma } = await buildService();
      prisma.match.findUnique.mockResolvedValue(
        match({ participants: [{ matchId: 'match-1', userId: 'a', readyAt: new Date() }, { matchId: 'match-1', userId: 'b', readyAt: null }] }),
      );
      prisma.matchParticipant.findMany.mockResolvedValue([
        { matchId: 'match-1', userId: 'a', readyAt: new Date() },
        { matchId: 'match-1', userId: 'b', readyAt: null },
      ]);

      await service.handleReady('match-1', 'a');

      expect(prisma.matchParticipant.update).not.toHaveBeenCalled();
    });

    it('hands off to the shared battle engine once both participants are ready', async () => {
      const { service, prisma, matches } = await buildService();
      prisma.match.findUnique.mockResolvedValue(match());
      prisma.matchParticipant.findMany.mockResolvedValue([
        { matchId: 'match-1', userId: 'a', readyAt: new Date() },
        { matchId: 'match-1', userId: 'b', readyAt: new Date() },
      ]);
      prisma.match.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.handleReady('match-1', 'b');

      expect(prisma.match.updateMany).toHaveBeenCalledWith({
        where: { id: 'match-1', status: 'PENDING_READY' },
        data: { status: 'READY' },
      });
      expect(matches.startQuickMatch).toHaveBeenCalledWith('match-1');
      expect(result).toEqual({ matchId: 'match-1', status: 'IN_PROGRESS' });
    });

    it('only one of two concurrent both-ready requests actually starts the match', async () => {
      const { service, prisma, matches } = await buildService();
      prisma.match.findUnique.mockResolvedValue(match());
      prisma.matchParticipant.findMany.mockResolvedValue([
        { matchId: 'match-1', userId: 'a', readyAt: new Date() },
        { matchId: 'match-1', userId: 'b', readyAt: new Date() },
      ]);
      // Simulate the loser: its conditional update affects 0 rows.
      prisma.match.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

      const [first, second] = await Promise.all([
        service.handleReady('match-1', 'a'),
        service.handleReady('match-1', 'b'),
      ]);

      const starts = [first, second].filter((r) => r.status === 'IN_PROGRESS');
      expect(starts).toHaveLength(1);
      expect(matches.startQuickMatch).toHaveBeenCalledTimes(1);
    });

    it('tells both players when one of them accepts', async () => {
      const { service, prisma, emit } = await buildService();
      prisma.match.findUnique.mockResolvedValue(match());
      prisma.matchParticipant.findMany.mockResolvedValue([
        { matchId: 'match-1', userId: 'a', readyAt: new Date() },
        { matchId: 'match-1', userId: 'b', readyAt: null },
      ]);

      await service.handleReady('match-1', 'a');

      const readyEvents = emit.mock.calls.filter(([event]) => event === 'match:ready');
      expect(readyEvents).toHaveLength(2);
      expect(readyEvents[0][1]).toEqual({ matchId: 'match-1', userId: 'a' });
    });

    it('reports the status the start produced, not an assumed IN_PROGRESS', async () => {
      const { service, prisma, matches } = await buildService();
      prisma.match.findUnique.mockResolvedValue(match());
      prisma.matchParticipant.findMany.mockResolvedValue([
        { matchId: 'match-1', userId: 'a', readyAt: new Date() },
        { matchId: 'match-1', userId: 'b', readyAt: new Date() },
      ]);
      prisma.match.updateMany.mockResolvedValue({ count: 1 });
      // e.g. the match was cancelled between the READY claim and the start
      matches.startQuickMatch.mockResolvedValue({ id: 'match-1', status: 'CANCELLED' });

      await expect(service.handleReady('match-1', 'b')).resolves.toEqual({
        matchId: 'match-1',
        status: 'CANCELLED',
      });
    });

    it('propagates a failed battle start (e.g. too few challenges)', async () => {
      const { service, prisma, matches } = await buildService();
      prisma.match.findUnique.mockResolvedValue(match());
      prisma.matchParticipant.findMany.mockResolvedValue([
        { matchId: 'match-1', userId: 'a', readyAt: new Date() },
        { matchId: 'match-1', userId: 'b', readyAt: new Date() },
      ]);
      prisma.match.updateMany.mockResolvedValue({ count: 1 });
      matches.startQuickMatch.mockRejectedValue(new Error('INSUFFICIENT_BATTLE_CHALLENGES'));

      await expect(service.handleReady('match-1', 'b')).rejects.toThrow('INSUFFICIENT_BATTLE_CHALLENGES');
    });
  });

  describe('processReadyTimeouts', () => {
    it('cancels an expired match, requeues only the ready player, with no rating impact', async () => {
      const { service, prisma, redis, emit } = await buildService();
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'match-1',
          status: 'PENDING_READY',
          readyDeadline: new Date(Date.now() - 1000),
          participants: [
            { matchId: 'match-1', userId: 'ready-user', readyAt: new Date(), ratingBefore: 1500 },
            { matchId: 'match-1', userId: 'no-show', readyAt: null, ratingBefore: 1500 },
          ],
        },
      ]);
      prisma.match.updateMany.mockResolvedValue({ count: 1 });

      await service.processReadyTimeouts();

      expect(prisma.match.updateMany).toHaveBeenCalledWith({
        where: { id: 'match-1', status: 'PENDING_READY' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      });
      expect(emit).toHaveBeenCalledWith('matchmaking:opponent-unavailable', { matchId: 'match-1' });
      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'ready-user')).toBe('1500');
      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'no-show')).toBeNull();
    });

    it('cancels with no requeue when neither participant readied', async () => {
      const { service, prisma, redis, emit } = await buildService();
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'match-2',
          status: 'PENDING_READY',
          readyDeadline: new Date(Date.now() - 1000),
          participants: [
            { matchId: 'match-2', userId: 'x', readyAt: null, ratingBefore: 1500 },
            { matchId: 'match-2', userId: 'y', readyAt: null, ratingBefore: 1500 },
          ],
        },
      ]);
      prisma.match.updateMany.mockResolvedValue({ count: 1 });

      await service.processReadyTimeouts();

      expect(emit).toHaveBeenCalledWith('matchmaking:cancelled', { matchId: 'match-2' });
      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'x')).toBeNull();
      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'y')).toBeNull();
    });

    it('skips a match whose timeout was already claimed by another instance/tick', async () => {
      const { service, prisma, emit } = await buildService();
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'match-3',
          status: 'PENDING_READY',
          readyDeadline: new Date(Date.now() - 1000),
          participants: [
            { matchId: 'match-3', userId: 'x', readyAt: new Date(), ratingBefore: 1500 },
            { matchId: 'match-3', userId: 'y', readyAt: null, ratingBefore: 1500 },
          ],
        },
      ]);
      prisma.match.updateMany.mockResolvedValue({ count: 0 });

      await service.processReadyTimeouts();

      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('processReadyTimeouts query', () => {
    it('cancels unanswered matches at the deadline but leaves an in-flight start a grace period', async () => {
      const { service, prisma } = await buildService();
      prisma.match.findMany.mockResolvedValue([]);
      const before = Date.now();

      await service.processReadyTimeouts();

      const where = prisma.match.findMany.mock.calls[0][0].where;
      const [pending, ready] = where.OR;
      expect(pending.status).toBe('PENDING_READY');
      expect(pending.readyDeadline.lt.getTime()).toBeGreaterThanOrEqual(before);
      expect(ready.status).toBe('READY');
      expect(ready.readyDeadline.lt.getTime()).toBeLessThanOrEqual(Date.now() - 30_000);
    });
  });

  describe('sweepStaleQueueEntries', () => {
    it('removes queue entries with no recent heartbeat and tells the user', async () => {
      const { service, redis, emit } = await buildService();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'stale-user');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, Date.now(), 'stale-user');
      // No lastseen key set for stale-user - simulates a dropped connection
      // past the grace period (enqueue() would normally set one).

      await service.sweepStaleQueueEntries();

      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'stale-user')).toBeNull();
      expect(emit).toHaveBeenCalledWith('matchmaking:cancelled', { reason: 'STALE' });
    });

    it('keeps queue entries with a fresh heartbeat', async () => {
      const { service, redis } = await buildService();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'fresh-user');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, Date.now(), 'fresh-user');
      await redis.set('matchmaking:quick:lastseen:fresh-user', '1', 'PX', 10_000);

      await service.sweepStaleQueueEntries();

      expect(await redis.zscore(MATCHMAKING_RATING_ZSET, 'fresh-user')).toBe('1500');
    });

    it('does not notify users whose entry is fresh', async () => {
      const { service, redis, emit } = await buildService();
      await redis.zadd(MATCHMAKING_RATING_ZSET, 1500, 'fresh-user');
      await redis.zadd(MATCHMAKING_JOINED_ZSET, Date.now(), 'fresh-user');
      await redis.set('matchmaking:quick:lastseen:fresh-user', '1', 'PX', 10_000);

      await service.sweepStaleQueueEntries();

      expect(emit).not.toHaveBeenCalled();
    });
  });
});
