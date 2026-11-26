import { ConfigService } from '@nestjs/config';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { RatingService } from '../rating/rating.service';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import type { RunnerJobPayload, RunnerJobResult } from '../challenges/challenge.types';
import {
  ActiveMatchExistsException,
  AlreadySolvedException,
  InsufficientBattleChallengesException,
  MatchAccessDeniedException,
  MatchAlreadyFinishedException,
  MatchChallengeNotFoundException,
  MatchExpiredException,
  PlayerAlreadyGaveUpException,
  RoomAccessDeniedException,
  RoomExpiredException,
  RoomHostRequiredException,
  RoomNotReadyException,
  RunnerUnavailableException,
} from '../../common/exceptions/app.exception';
import { MatchesService } from './matches.service';
import { MatchSelectionService } from './match-selection.service';
import { MatchFinalizationService } from './match-finalization.service';
import { MatchTimeoutService, STUCK_SUBMISSION_MS } from './match-timeout.service';
import { RunnerResultService } from '../submissions/runner-result.service';
import { SubmissionsService } from '../submissions/submissions.service';
import {
  ADMIN,
  CHECKER_SECRET,
  FakePrisma,
  GENERATOR_SECRET,
  HIDDEN_SECRET,
  MASTER1,
  REFERENCE_SECRET,
  RYAN,
  STRANGER,
  seedIneligible,
  seedPlayers,
  seedPool,
  seedRoom,
} from './battle.test-utils';

const PLAYER = (id: string) => ({ id, role: 'USER' as const });
const SOURCE = (tag: string) => `function solve(n) { return n; } /* SOURCE_${tag} */`;

function accepted(job: RunnerJobPayload): RunnerJobResult {
  return {
    jobId: `job-${Math.random().toString(36).slice(2)}`,
    jobType: 'SUBMISSION',
    ok: true,
    passedTests: job.tests.length,
    totalTests: job.tests.length,
    runtimeMs: 4,
    tests: job.tests.map((t) => ({
      testId: t.id,
      hidden: t.hidden,
      order: t.order,
      status: 'PASSED' as const,
      runtimeMs: 1,
    })),
  };
}

function wrongAnswer(job: RunnerJobPayload): RunnerJobResult {
  const last = job.tests.length - 1;
  return {
    ...accepted(job),
    passedTests: last,
    tests: job.tests.map((t, index) => ({
      testId: t.id,
      hidden: t.hidden,
      order: t.order,
      status: index === last ? ('WRONG_ANSWER' as const) : ('PASSED' as const),
      runtimeMs: 1,
      message: index === last ? `Expected ${HIDDEN_SECRET}` : null,
    })),
  };
}

function harness(config: Record<string, unknown> = {}) {
  const prisma = new FakePrisma();
  const events: { to: string; event: string; payload: any }[] = [];
  const socket = {
    emitToUser: jest.fn((userId: string, event: string, payload: unknown) =>
      events.push({ to: `user:${userId}`, event, payload }),
    ),
    emitToMatch: jest.fn((matchId: string, event: string, payload: unknown) =>
      events.push({ to: `match:${matchId}`, event, payload }),
    ),
  };
  const rating = { applyMatchRating: jest.fn(async () => ({ changes: {} })) };
  const runner = { submit: jest.fn(async (job: RunnerJobPayload) => accepted(job)) };
  const configService = { get: jest.fn((key: string) => config[key]) } as unknown as ConfigService;

  const db = prisma as unknown as PrismaService;
  const gateway = socket as unknown as SocketGateway;
  const selection = new MatchSelectionService(db, configService);
  const finalization = new MatchFinalizationService(db, gateway, rating as unknown as RatingService);
  const matches = new MatchesService(db, selection, gateway, configService);
  const results = new RunnerResultService(db, finalization, gateway);
  const submissions = new SubmissionsService(
    db,
    runner as unknown as JudgeRunnerClient,
    results,
    gateway,
  );
  const timeout = new MatchTimeoutService(db, finalization, configService);

  const eventsNamed = (event: string) => events.filter((e) => e.event === event);
  const match = (id: string) => prisma.rows('match').find((m) => m.id === id)!;
  const challengeIds = (matchId: string) =>
    prisma
      .rows('matchChallenge')
      .filter((mc) => mc.matchId === matchId)
      .sort((a, b) => a.position - b.position)
      .map((mc) => mc.id as string);
  const progress = (matchChallengeId: string, userId: string) =>
    prisma
      .rows('matchChallengeProgress')
      .find((p) => p.matchChallengeId === matchChallengeId && p.userId === userId)!;

  return {
    prisma,
    socket,
    events,
    eventsNamed,
    rating,
    runner,
    selection,
    finalization,
    matches,
    results,
    submissions,
    timeout,
    match,
    challengeIds,
    progress,
  };
}

type Harness = ReturnType<typeof harness>;

async function startPrivateBattle(h: Harness, pool: Record<string, number> = { EASY: 3, MEDIUM: 3, HARD: 2 }) {
  seedPlayers(h.prisma);
  seedPool(h.prisma, pool);
  seedRoom(h.prisma);
  const started = await h.matches.startPrivateRoomMatch('KZHBQM', RYAN);
  const matchId = started.match.id;
  return { matchId, mcs: h.challengeIds(matchId), started };
}

/** Solves the given positions (1-based) for a player through the real submit path. */
async function solve(h: Harness, matchId: string, userId: string, positions: number[]) {
  const mcs = h.challengeIds(matchId);
  for (const position of positions) {
    await h.submissions.submit(userId, matchId, mcs[position - 1], SOURCE(`${userId}-${position}`));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('Five-challenge battle engine', () => {
  describe('starting a private-room match', () => {
    it('starts a match for a room with two players, as casual PRIVATE_ROOM', async () => {
      const h = harness();
      const { matchId, started } = await startPrivateBattle(h);

      const match = h.match(matchId);
      expect(started.alreadyStarted).toBe(false);
      expect(match.status).toBe(MatchStatus.IN_PROGRESS);
      expect(match.type).toBe('PRIVATE_ROOM');
      expect(match.ratingEligible).toBe(false);
      expect(match.startedAt).toBeInstanceOf(Date);
      expect(match.expiresAt.getTime() - match.startedAt.getTime()).toBe(30 * 60_000);
      expect(h.prisma.rows('room')[0].status).toBe('IN_MATCH');
      // Ratings snapshotted server-side from UserStats.
      const participants = h.prisma.rows('matchParticipant');
      expect(participants.map((p) => [p.userId, p.ratingBefore]).sort()).toEqual([
        [MASTER1, 1720],
        [RYAN, 1850],
      ]);
      expect(h.eventsNamed('match:started').map((e) => e.to).sort()).toEqual([
        `user:${MASTER1}`,
        `user:${RYAN}`,
      ]);
    });

    it('honours MATCH_DURATION_MINUTES', async () => {
      const h = harness({ MATCH_DURATION_MINUTES: 12 });
      const { matchId } = await startPrivateBattle(h);
      const match = h.match(matchId);
      expect(match.expiresAt.getTime() - match.startedAt.getTime()).toBe(12 * 60_000);
    });

    it('refuses a room with only one player', async () => {
      const h = harness();
      seedPlayers(h.prisma);
      seedPool(h.prisma, { EASY: 3, MEDIUM: 3, HARD: 2 });
      seedRoom(h.prisma, { guestId: null });

      await expect(h.matches.startPrivateRoomMatch('KZHBQM', RYAN)).rejects.toBeInstanceOf(
        RoomNotReadyException,
      );
      expect(h.prisma.rows('match')).toHaveLength(0);
    });

    it('refuses the non-host player and outsiders', async () => {
      const h = harness();
      seedPlayers(h.prisma);
      seedPool(h.prisma, { EASY: 3, MEDIUM: 3, HARD: 2 });
      seedRoom(h.prisma);

      await expect(h.matches.startPrivateRoomMatch('KZHBQM', MASTER1)).rejects.toBeInstanceOf(
        RoomHostRequiredException,
      );
      await expect(h.matches.startPrivateRoomMatch('KZHBQM', STRANGER)).rejects.toBeInstanceOf(
        RoomAccessDeniedException,
      );
      expect(h.prisma.rows('match')).toHaveLength(0);
    });

    it('refuses an expired room', async () => {
      const h = harness();
      seedPlayers(h.prisma);
      seedPool(h.prisma, { EASY: 3, MEDIUM: 3, HARD: 2 });
      seedRoom(h.prisma, { expiresAt: new Date(Date.now() - 1000) });

      await expect(h.matches.startPrivateRoomMatch('KZHBQM', RYAN)).rejects.toBeInstanceOf(
        RoomExpiredException,
      );
    });

    it('refuses when a player is already in another active match', async () => {
      const h = harness();
      seedPlayers(h.prisma);
      seedPool(h.prisma, { EASY: 3, MEDIUM: 3, HARD: 2 });
      seedRoom(h.prisma);
      const [other] = h.prisma.seed('match', [{ type: 'QUICK_MATCH', status: 'IN_PROGRESS' }]);
      h.prisma.seed('matchParticipant', [{ matchId: other.id, userId: MASTER1, ratingBefore: 1720 }]);

      await expect(h.matches.startPrivateRoomMatch('KZHBQM', RYAN)).rejects.toBeInstanceOf(
        ActiveMatchExistsException,
      );
    });

    it('creates exactly one match when Start is double-clicked', async () => {
      const h = harness();
      seedPlayers(h.prisma);
      seedPool(h.prisma, { EASY: 3, MEDIUM: 3, HARD: 2 });
      seedRoom(h.prisma);

      const [first, second] = await Promise.all([
        h.matches.startPrivateRoomMatch('KZHBQM', RYAN),
        h.matches.startPrivateRoomMatch('KZHBQM', RYAN),
      ]);

      expect(h.prisma.rows('match')).toHaveLength(1);
      expect(first.match.id).toBe(second.match.id);
      expect([first.alreadyStarted, second.alreadyStarted].sort()).toEqual([false, true]);
      expect(h.prisma.rows('matchChallenge')).toHaveLength(5);
      expect(h.prisma.rows('matchChallengeProgress')).toHaveLength(10);
      expect(h.eventsNamed('match:started')).toHaveLength(2); // one per player, once
      // A later retry is answered from the stored match.
      const again = await h.matches.startPrivateRoomMatch('KZHBQM', RYAN);
      expect(again).toMatchObject({ alreadyStarted: true, match: { id: first.match.id } });
    });

    it('stores exactly five distinct challenges at positions 1..5', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);

      const rows = h.prisma.rows('matchChallenge').filter((mc) => mc.matchId === matchId);
      expect(rows).toHaveLength(5);
      expect(rows.map((r) => r.position).sort()).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(rows.map((r) => r.challengeId)).size).toBe(5);
    });

    it('uses the 2 EASY / 2 MEDIUM / 1 HARD distribution, easiest first', async () => {
      const h = harness();
      const { mcs } = await startPrivateBattle(h);

      const difficultyOf = (mcId: string) => {
        const mc = h.prisma.rows('matchChallenge').find((r) => r.id === mcId)!;
        return h.prisma.rows('challenge').find((c) => c.id === mc.challengeId)!.difficulty;
      };
      expect(mcs.map(difficultyOf)).toEqual(['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'HARD']);
    });

    it('only ever selects published, validated, runnable challenges with hidden tests', async () => {
      const h = harness();
      seedPlayers(h.prisma);
      const decoys = seedIneligible(h.prisma);
      const eligible = seedPool(h.prisma, { EASY: 2, MEDIUM: 2, HARD: 1 });
      seedRoom(h.prisma);

      const { match } = await h.matches.startPrivateRoomMatch('KZHBQM', RYAN);

      const chosen = h.prisma
        .rows('matchChallenge')
        .filter((mc) => mc.matchId === match.id)
        .map((mc) => mc.challengeId);
      expect(chosen.sort()).toEqual(eligible.map((c) => c.id).sort());
      expect(chosen.some((id) => decoys.some((d) => d.id === id))).toBe(false);
    });

    it('refuses to start, and leaves the room untouched, when the pool is too small', async () => {
      const h = harness();
      seedPlayers(h.prisma);
      seedPool(h.prisma, { EASY: 2, MEDIUM: 1, HARD: 1 });
      seedIneligible(h.prisma);
      seedRoom(h.prisma);

      await expect(h.matches.startPrivateRoomMatch('KZHBQM', RYAN)).rejects.toBeInstanceOf(
        InsufficientBattleChallengesException,
      );
      expect(h.prisma.rows('match')).toHaveLength(0);
      expect(h.prisma.rows('matchChallenge')).toHaveLength(0);
      expect(h.prisma.rows('room')[0].status).toBe('WAITING');
    });

    it('creates one NOT_STARTED progress row per player per challenge, so both start at 0/5', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);

      const rows = h.prisma.rows('matchChallengeProgress');
      expect(rows).toHaveLength(10);
      expect(rows.every((r) => r.status === 'NOT_STARTED' && r.attempts === 0)).toBe(true);
      for (const mcId of mcs) {
        expect(rows.filter((r) => r.matchChallengeId === mcId).map((r) => r.userId).sort()).toEqual([
          MASTER1,
          RYAN,
        ]);
      }

      const view = await h.matches.getMatch(matchId, PLAYER(RYAN));
      expect(view.match.me).toMatchObject({ solved: 0, total: 5 });
      expect(view.match.opponent).toMatchObject({ solved: 0, total: 5 });
      const progress = await h.matches.getProgress(matchId, PLAYER(MASTER1));
      expect(progress.progress.players.map((p) => p.solved)).toEqual([0, 0]);
    });
  });

  describe('starting a Quick Match', () => {
    function seedReadyQuickMatch(h: Harness) {
      seedPlayers(h.prisma);
      const [match] = h.prisma.seed('match', [
        { type: 'QUICK_MATCH', status: 'READY', ratingEligible: true },
      ]);
      h.prisma.seed('matchParticipant', [
        { matchId: match.id, userId: RYAN, ratingBefore: 1850, readyAt: new Date() },
        { matchId: match.id, userId: MASTER1, ratingBefore: 1720, readyAt: new Date() },
      ]);
      return match;
    }

    it('uses the same five-challenge engine and stays rating eligible', async () => {
      const h = harness();
      const match = seedReadyQuickMatch(h);
      seedPool(h.prisma, { EASY: 3, MEDIUM: 3, HARD: 2 });

      const started = await h.matches.startQuickMatch(match.id);

      expect(started).toMatchObject({ status: 'IN_PROGRESS', type: 'QUICK_MATCH', ratingEligible: true });
      expect(h.challengeIds(match.id)).toHaveLength(5);
      expect(h.prisma.rows('matchChallengeProgress')).toHaveLength(10);
      expect(h.match(match.id).expiresAt).toBeInstanceOf(Date);
    });

    it('shows the ready check - deadline and who accepted - only while the match waits on it', async () => {
      const h = harness();
      seedPlayers(h.prisma);
      const readyDeadline = new Date(Date.now() + 10_000);
      const [match] = h.prisma.seed('match', [
        {
          type: 'QUICK_MATCH',
          status: 'PENDING_READY',
          ratingEligible: true,
          readyDeadline,
        },
      ]);
      const matchId = match.id as string;
      h.prisma.seed('matchParticipant', [
        { matchId, userId: RYAN, ratingBefore: 1850, readyAt: new Date() },
        { matchId, userId: MASTER1, ratingBefore: 1720 },
      ]);
      const view = async (userId: string) =>
        (await h.matches.getMatch(matchId, PLAYER(userId))).match;

      const ryan = await view(RYAN);
      expect(ryan.readyDeadline).toEqual(readyDeadline);
      expect(ryan.me).toMatchObject({ id: RYAN, ready: true });
      expect(ryan.opponent).toMatchObject({ id: MASTER1, ready: false });
      const master = await view(MASTER1);
      expect(master.me).toMatchObject({ id: MASTER1, ready: false });
      expect(master.opponent).toMatchObject({ id: RYAN, ready: true });

      // Both accepted, start in flight: still part of the ready check.
      for (const row of h.prisma.rows('matchParticipant')) {
        row.readyAt = new Date();
      }
      h.match(matchId).status = 'READY';
      const ready = await view(RYAN);
      expect(ready.readyDeadline).toEqual(readyDeadline);
      expect([ready.me?.ready, ready.opponent?.ready]).toEqual([true, true]);

      for (const status of ['IN_PROGRESS', 'CANCELLED']) {
        h.match(matchId).status = status;
        expect((await view(RYAN)).readyDeadline).toBeNull();
      }
    });

    it('has no ready check for a private-room match', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);

      const { match } = await h.matches.getMatch(matchId, PLAYER(RYAN));

      expect(match.readyDeadline).toBeNull();
      expect([match.me?.ready, match.opponent?.ready]).toEqual([false, false]);
    });

    it('cancels (unrated) instead of starting a broken match when the pool is too small', async () => {
      const h = harness();
      const match = seedReadyQuickMatch(h);
      seedPool(h.prisma, { EASY: 4 });

      await expect(h.matches.startQuickMatch(match.id)).rejects.toBeInstanceOf(
        InsufficientBattleChallengesException,
      );
      expect(h.match(match.id)).toMatchObject({ status: 'CANCELLED', finishReason: 'SYSTEM_CANCELLED' });
      expect(h.prisma.rows('matchChallenge')).toHaveLength(0);
      expect(h.rating.applyMatchRating).not.toHaveBeenCalled();
      // Both accepted, so both are told the match could not start.
      const payload = { matchId: match.id as string, reason: 'START_FAILED' };
      expect(h.eventsNamed('matchmaking:cancelled')).toEqual(
        [RYAN, MASTER1].map((userId) => ({
          to: `user:${userId}`,
          event: 'matchmaking:cancelled',
          payload,
        })),
      );
    });
  });

  describe('reading a match', () => {
    it('gives both players the same five challenges', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);

      const ryan = await h.matches.getMatch(matchId, PLAYER(RYAN));
      const master = await h.matches.getMatch(matchId, PLAYER(MASTER1));
      const ids = (view: typeof ryan) => view.match.challenges.map((c) => c.matchChallengeId);
      expect(ids(ryan)).toEqual(ids(master));
      expect(ryan.match.me!.id).toBe(RYAN);
      expect(master.match.me!.id).toBe(MASTER1);
      expect(ryan.match.me!.rating).toBe(1850);
      expect(ryan.match.opponent!.rating).toBe(1720);

      const statements = await h.matches.getChallenges(matchId, PLAYER(MASTER1));
      expect(statements.challenges.map((c) => c.matchChallengeId)).toEqual(ids(ryan));
    });

    it('refuses users who are not in the match, but lets an ADMIN spectate', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);

      await expect(h.matches.getMatch(matchId, PLAYER(STRANGER))).rejects.toBeInstanceOf(
        MatchAccessDeniedException,
      );
      await expect(h.matches.getChallenges(matchId, PLAYER(STRANGER))).rejects.toBeInstanceOf(
        MatchAccessDeniedException,
      );
      await expect(h.matches.getProgress(matchId, PLAYER(STRANGER))).rejects.toBeInstanceOf(
        MatchAccessDeniedException,
      );

      const spectator = await h.matches.getMatch(matchId, { id: ADMIN, role: 'ADMIN' });
      expect(spectator.match.viewer).toBe('SPECTATOR');
    });

    it('never exposes hidden tests, reference solutions, checkers or generators', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);

      const payload = JSON.stringify([
        await h.matches.getMatch(matchId, PLAYER(RYAN)),
        await h.matches.getChallenges(matchId, PLAYER(RYAN)),
        await h.matches.getProgress(matchId, PLAYER(RYAN)),
      ]);
      for (const secret of [HIDDEN_SECRET, REFERENCE_SECRET, CHECKER_SECRET, GENERATOR_SECRET]) {
        expect(payload).not.toContain(secret);
      }
      const statements = await h.matches.getChallenges(matchId, PLAYER(RYAN));
      for (const { challenge } of statements.challenges) {
        expect(challenge.sampleTestCases).toHaveLength(1);
        expect(challenge).not.toHaveProperty('referenceSolutionCode');
        expect(challenge).not.toHaveProperty('customCheckerCode');
        expect(challenge).not.toHaveProperty('testGeneratorCode');
      }
    });

    it('never exposes the opponent’s source code, in responses or events', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);
      await solve(h, matchId, MASTER1, [1]);

      const view = await h.matches.getMatch(matchId, PLAYER(RYAN));
      expect(JSON.stringify(view)).not.toContain(`SOURCE_${MASTER1}`);
      expect(JSON.stringify(h.events)).not.toContain('SOURCE_');
      expect(JSON.stringify(h.events)).not.toContain(HIDDEN_SECRET);
    });

    it('recovers the full state after a refresh', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      await solve(h, matchId, RYAN, [3]);

      const active = await h.matches.getActiveMatchForUser(RYAN);
      expect(active.match).toMatchObject({ id: matchId, status: 'IN_PROGRESS' });

      const view = await h.matches.getMatch(matchId, PLAYER(RYAN));
      expect(view.match.me!.solved).toBe(1);
      expect(view.match.challenges.find((c) => c.matchChallengeId === mcs[2])!.myProgress.status).toBe(
        'SOLVED',
      );
      expect(view.match.log.map((e) => e.type)).toEqual(['MATCH_STARTED', 'CHALLENGE_SOLVED']);
    });
  });

  describe('run and submit', () => {
    it('lets a player solve challenge 3 before challenge 1', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);

      const result = await h.submissions.submit(RYAN, matchId, mcs[2], SOURCE('c3'));

      expect(result.solved).toBe(true);
      expect(h.progress(mcs[2], RYAN).status).toBe('SOLVED');
      expect(h.progress(mcs[0], RYAN).status).toBe('NOT_STARTED');
    });

    it('marks ATTEMPTING on the first attempt and tells the opponent once', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      h.runner.submit.mockImplementation(async (job: RunnerJobPayload) => wrongAnswer(job));

      await h.submissions.runTests(RYAN, matchId, mcs[1], SOURCE('run'));
      expect(h.progress(mcs[1], RYAN)).toMatchObject({ status: 'ATTEMPTING', attempts: 0 });

      await h.submissions.submit(RYAN, matchId, mcs[1], SOURCE('a'));
      await h.submissions.submit(RYAN, matchId, mcs[1], SOURCE('b'));
      expect(h.progress(mcs[1], RYAN)).toMatchObject({ status: 'ATTEMPTING', attempts: 2 });
      expect(h.eventsNamed('challenge:attempting')).toHaveLength(1);
      expect(h.eventsNamed('challenge:attempting')[0].payload).toEqual({
        matchId,
        userId: RYAN,
        matchChallengeId: mcs[1],
      });
    });

    it('Run Tests uses public tests only and never solves', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);

      const run = await h.submissions.runTests(RYAN, matchId, mcs[0], SOURCE('run'));

      const job: RunnerJobPayload = h.runner.submit.mock.calls[0][0];
      expect(job.tests.every((t) => !t.hidden)).toBe(true);
      expect(job.generatorSeeds).toBeUndefined();
      expect(run.run.passedTests).toBe(1);
      expect(h.progress(mcs[0], RYAN).status).toBe('ATTEMPTING');
      expect(h.prisma.rows('submission')).toHaveLength(0);
    });

    it('does not solve on a failed submission, and hides hidden-test detail', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      h.runner.submit.mockImplementation(async (job: RunnerJobPayload) => wrongAnswer(job));

      const result = await h.submissions.submit(RYAN, matchId, mcs[0], SOURCE('wrong'));

      expect(result.solved).toBe(false);
      expect(result.submission!.status).toBe('WRONG_ANSWER');
      expect(h.progress(mcs[0], RYAN).status).toBe('ATTEMPTING');
      expect(JSON.stringify(result)).not.toContain(HIDDEN_SECRET);
      expect(h.eventsNamed('challenge:solved')).toHaveLength(0);
    });

    it('sends public and hidden tests with the submission to the runner', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);

      await h.submissions.submit(RYAN, matchId, mcs[0], SOURCE('x'));
      const job: RunnerJobPayload = h.runner.submit.mock.calls[0][0];
      expect(job.tests.filter((t) => t.hidden)).toHaveLength(2);
      expect(job.sourceCode).toBe(SOURCE('x'));
    });

    it('marks SOLVED on ACCEPTED with solvedAt, duration and the accepted submission', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);

      const result = await h.submissions.submit(RYAN, matchId, mcs[0], SOURCE('ok'));

      const row = h.progress(mcs[0], RYAN);
      expect(row.status).toBe('SOLVED');
      expect(row.solvedAt).toBeInstanceOf(Date);
      expect(row.solveDurationMs).toBe(row.solvedAt.getTime() - h.match(matchId).startedAt.getTime());
      expect(row.bestSubmissionId).toBe(result.submission!.id);
      expect(result.submission!.status).toBe('ACCEPTED');
      // Lifetime profile counter moves with the solve.
      expect(h.prisma.rows('userStats').find((r) => r.userId === RYAN)!.challengesSolved).toBe(1);
    });

    it('updates both players’ views and emits challenge:solved and match:progress', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);

      await solve(h, matchId, RYAN, [1, 3]);
      await solve(h, matchId, MASTER1, [1]);

      const ryan = await h.matches.getMatch(matchId, PLAYER(RYAN));
      const master = await h.matches.getMatch(matchId, PLAYER(MASTER1));
      expect([ryan.match.me!.solved, ryan.match.opponent!.solved]).toEqual([2, 1]);
      expect([master.match.me!.solved, master.match.opponent!.solved]).toEqual([1, 2]);
      expect(master.match.challenges[2].opponentProgress.status).toBe('SOLVED');
      expect(master.match.challenges[2]).not.toHaveProperty('opponentProgress.attempts');

      const solvedEvents = h.eventsNamed('challenge:solved');
      expect(solvedEvents).toHaveLength(3);
      expect(solvedEvents[1]).toEqual({
        to: `match:${matchId}`,
        event: 'challenge:solved',
        payload: {
          matchId,
          userId: RYAN,
          matchChallengeId: mcs[2],
          challengeId: h.prisma.rows('matchChallenge').find((mc) => mc.id === mcs[2])!.challengeId,
          solvedCount: 2,
          totalChallenges: 5,
        },
      });
      const lastProgress = h.eventsNamed('match:progress').at(-1)!;
      expect(lastProgress.payload.players).toEqual(
        expect.arrayContaining([
          { userId: RYAN, solved: 2, total: 5 },
          { userId: MASTER1, solved: 1, total: 5 },
        ]),
      );
    });

    it('refuses to re-submit a solved challenge', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      await solve(h, matchId, RYAN, [1]);

      await expect(
        h.submissions.submit(RYAN, matchId, mcs[0], SOURCE('again')),
      ).rejects.toBeInstanceOf(AlreadySolvedException);
    });

    it('counts a solve once and keeps the first solvedAt when two accepted submissions race', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      const [first, second] = h.prisma.seed('submission', [
        { userId: RYAN, challengeId: 'c', matchId, matchChallengeId: mcs[0], sourceCode: 'a', status: 'RUNNING' },
        { userId: RYAN, challengeId: 'c', matchId, matchChallengeId: mcs[0], sourceCode: 'b', status: 'RUNNING' },
      ]);
      const job = { tests: [{ id: 't', hidden: false, order: 0 }] } as unknown as RunnerJobPayload;

      const one = await h.results.recordVerdict(first.id, accepted(job), 1);
      const solvedAt = h.progress(mcs[0], RYAN).solvedAt;
      const two = await h.results.recordVerdict(second.id, accepted(job), 1);

      expect([one.newlySolved, two.newlySolved]).toEqual([true, false]);
      expect(h.progress(mcs[0], RYAN)).toMatchObject({ solvedAt, bestSubmissionId: first.id });
      const view = await h.matches.getMatch(matchId, PLAYER(RYAN));
      expect(view.match.me!.solved).toBe(1);
      expect(h.prisma.rows('userStats').find((r) => r.userId === RYAN)!.challengesSolved).toBe(1);
    });

    it('treats a duplicated runner verdict as a no-op', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      await solve(h, matchId, RYAN, [1, 2, 3, 4]);
      const [pending] = h.prisma.seed('submission', [
        { userId: RYAN, challengeId: 'c', matchId, matchChallengeId: mcs[4], sourceCode: 'x', status: 'RUNNING' },
      ]);
      const job = { tests: [{ id: 't', hidden: false, order: 0 }] } as unknown as RunnerJobPayload;
      const verdict = accepted(job);

      const first = await h.results.recordVerdict(pending.id, verdict, 1);
      const eventCount = h.events.length;
      const retry = await h.results.recordVerdict(pending.id, verdict, 1);

      expect(first).toMatchObject({ newlySolved: true, finished: true, duplicate: false });
      expect(retry).toMatchObject({ newlySolved: false, finished: false, duplicate: true, status: 'ACCEPTED' });
      expect(h.events.length).toBe(eventCount);
      expect(h.rating.applyMatchRating).toHaveBeenCalledTimes(1);
    });

    it('records SYSTEM_ERROR and reports RUNNER_UNAVAILABLE when the runner fails', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      h.runner.submit.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(h.submissions.submit(RYAN, matchId, mcs[0], SOURCE('x'))).rejects.toBeInstanceOf(
        RunnerUnavailableException,
      );
      expect(h.prisma.rows('submission')[0].status).toBe('SYSTEM_ERROR');
      expect(h.progress(mcs[0], RYAN).status).toBe('ATTEMPTING');
    });

    it('refuses outsiders and challenges that are not part of the match', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);

      await expect(h.submissions.submit(STRANGER, matchId, mcs[0], 'x')).rejects.toBeInstanceOf(
        MatchAccessDeniedException,
      );
      await expect(
        h.submissions.submit(RYAN, matchId, 'not-a-match-challenge', 'x'),
      ).rejects.toBeInstanceOf(MatchChallengeNotFoundException);
    });

    it('refuses submissions once the clock has run out', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      h.match(matchId).expiresAt = new Date(Date.now() - 1);

      await expect(h.submissions.submit(RYAN, matchId, mcs[0], 'x')).rejects.toBeInstanceOf(
        MatchExpiredException,
      );
      expect(h.runner.submit).not.toHaveBeenCalled();
    });
  });

  describe('finishing by solving all five', () => {
    it('finishes the match the moment a player solves the fifth challenge', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);
      await solve(h, matchId, MASTER1, [2]);

      await solve(h, matchId, RYAN, [5, 1, 4, 2]);
      expect(h.match(matchId).status).toBe('IN_PROGRESS');
      await solve(h, matchId, RYAN, [3]);

      expect(h.match(matchId)).toMatchObject({
        status: 'FINISHED',
        winnerId: RYAN,
        resultType: 'WIN',
        finishReason: 'ALL_CHALLENGES_SOLVED',
      });
      expect(h.prisma.rows('room')[0].status).toBe('FINISHED');
      expect(h.rating.applyMatchRating).toHaveBeenCalledTimes(1);
      expect(h.rating.applyMatchRating).toHaveBeenCalledWith(matchId);
      const finished = h.eventsNamed('match:finished');
      expect(finished).toHaveLength(1);
      expect(finished[0].payload).toMatchObject({ winnerId: RYAN, ratingEligible: false });

      const view = await h.matches.getMatch(matchId, PLAYER(MASTER1));
      expect(view.match.log.at(-1)).toMatchObject({ type: 'MATCH_FINISHED', winnerId: RYAN });
    });

    it('does not count solves after the match is over', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);
      await solve(h, matchId, RYAN, [1, 2, 3, 4, 5]);

      await expect(solve(h, matchId, MASTER1, [1])).rejects.toBeInstanceOf(
        MatchAlreadyFinishedException,
      );
    });

    it('produces one deterministic result when both final solves land together', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      await solve(h, matchId, RYAN, [1, 2, 3, 4]);
      await solve(h, matchId, MASTER1, [1, 2, 3, 4]);

      // Both fifth submissions are with the runner at the same time; master1's
      // verdict comes back first.
      const ryanVerdict = deferred<RunnerJobResult>();
      const masterVerdict = deferred<RunnerJobResult>();
      h.runner.submit.mockImplementation((job: RunnerJobPayload) =>
        (job.metadata as { userId: string }).userId === RYAN ? ryanVerdict.promise : masterVerdict.promise,
      );
      const ryanSubmit = h.submissions.submit(RYAN, matchId, mcs[4], SOURCE('r5'));
      const masterSubmit = h.submissions.submit(MASTER1, matchId, mcs[4], SOURCE('m5'));
      await new Promise((resolve) => setImmediate(resolve));
      const [ryanJob, masterJob] = [
        h.runner.submit.mock.calls.find((c) => (c[0].metadata as any).userId === RYAN)![0],
        h.runner.submit.mock.calls.find((c) => (c[0].metadata as any).userId === MASTER1)![0],
      ];
      masterVerdict.resolve(accepted(masterJob));
      ryanVerdict.resolve(accepted(ryanJob));
      const [ryanResult, masterResult] = await Promise.all([ryanSubmit, masterSubmit]);

      const match = h.match(matchId);
      expect(match).toMatchObject({ status: 'FINISHED', winnerId: MASTER1, finishReason: 'ALL_CHALLENGES_SOLVED' });
      expect([masterResult.matchFinished, ryanResult.matchFinished]).toEqual([true, false]);
      // Ryan's verdict is stored, but the match was already over.
      expect(ryanResult.submission!.status).toBe('ACCEPTED');
      expect(h.progress(mcs[4], RYAN).status).not.toBe('SOLVED');
      expect(h.eventsNamed('match:finished')).toHaveLength(1);
      expect(h.rating.applyMatchRating).toHaveBeenCalledTimes(1);
      expect(h.prisma.lockLog.filter((key) => key === `Match:${matchId}`).length).toBeGreaterThanOrEqual(2);
    });

    it('lets the earlier commit win whichever order the players submitted in', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      await solve(h, matchId, RYAN, [1, 2, 3, 4]);
      await solve(h, matchId, MASTER1, [1, 2, 3, 4]);
      const [ryanSub, masterSub] = h.prisma.seed('submission', [
        { userId: RYAN, challengeId: 'c', matchId, matchChallengeId: mcs[4], sourceCode: 'r', status: 'RUNNING' },
        { userId: MASTER1, challengeId: 'c', matchId, matchChallengeId: mcs[4], sourceCode: 'm', status: 'RUNNING' },
      ]);
      const job = { tests: [{ id: 't', hidden: false, order: 0 }] } as unknown as RunnerJobPayload;

      const outcomes = await Promise.all([
        h.results.recordVerdict(ryanSub.id, accepted(job), 1),
        h.results.recordVerdict(masterSub.id, accepted(job), 1),
      ]);

      expect(outcomes.filter((o) => o.finished)).toHaveLength(1);
      expect(h.match(matchId).winnerId).toBe(RYAN); // its lock request came first
      expect(h.rating.applyMatchRating).toHaveBeenCalledTimes(1);
    });
  });

  describe('giving up', () => {
    it('finishes the match with the opponent as winner', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);
      await solve(h, matchId, RYAN, [1, 2]);

      const result = await h.finalization.giveUp(matchId, RYAN);

      expect(result.match).toMatchObject({
        status: 'FINISHED',
        winnerId: MASTER1,
        resultType: 'WIN',
        finishReason: 'PLAYER_GAVE_UP',
      });
      expect(h.prisma.rows('matchParticipant').find((p) => p.userId === RYAN)!.gaveUpAt).toBeInstanceOf(Date);
      expect(h.eventsNamed('player:gave-up')).toHaveLength(1);
      expect(h.eventsNamed('match:finished')).toHaveLength(1);
      expect(h.rating.applyMatchRating).toHaveBeenCalledTimes(1);
    });

    it('is idempotent for a double click and cannot be processed twice', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);

      const [a, b] = await Promise.all([
        h.finalization.giveUp(matchId, RYAN),
        h.finalization.giveUp(matchId, RYAN),
      ]);
      const again = await h.finalization.giveUp(matchId, RYAN);

      expect(a.match).toEqual(b.match);
      expect(again.match).toEqual(a.match);
      expect(h.eventsNamed('match:finished')).toHaveLength(1);
      expect(h.rating.applyMatchRating).toHaveBeenCalledTimes(1);
      await expect(h.finalization.giveUp(matchId, MASTER1)).rejects.toBeInstanceOf(
        MatchAlreadyFinishedException,
      );
    });

    it('blocks further play for the player who gave up', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      h.prisma.rows('matchParticipant').find((p) => p.userId === RYAN)!.gaveUpAt = new Date();

      await expect(h.submissions.submit(RYAN, matchId, mcs[0], 'x')).rejects.toBeInstanceOf(
        PlayerAlreadyGaveUpException,
      );
    });

    it('refuses outsiders', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);
      await expect(h.finalization.giveUp(matchId, STRANGER)).rejects.toBeInstanceOf(
        MatchAccessDeniedException,
      );
      expect(h.match(matchId).status).toBe('IN_PROGRESS');
    });
  });

  describe('timeout', () => {
    async function expiredBattle(h: Harness, ryan: number[], master: number[]) {
      const { matchId, mcs } = await startPrivateBattle(h);
      const rows = (userId: string, durations: number[]) =>
        durations.forEach((ms, i) =>
          Object.assign(h.progress(mcs[i], userId), {
            status: 'SOLVED',
            solvedAt: new Date(h.match(matchId).startedAt.getTime() + ms),
            solveDurationMs: ms,
          }),
        );
      rows(RYAN, ryan);
      rows(MASTER1, master);
      h.match(matchId).expiresAt = new Date(Date.now() - 1000);
      return matchId;
    }

    it('gives the win to the player with more solves', async () => {
      const h = harness();
      const matchId = await expiredBattle(h, [60_000], [10_000, 20_000]);
      await h.timeout.resolveExpiredMatches(new Date(Date.now() + 120_000));
      expect(h.match(matchId)).toMatchObject({ status: 'FINISHED', winnerId: MASTER1, finishReason: 'TIME_EXPIRED' });
    });

    it('breaks a tied solve count on lower total solve time', async () => {
      const h = harness();
      const matchId = await expiredBattle(
        h,
        [100_000, 200_000, 300_000, 92_000],   // 11m 32s
        [200_000, 250_000, 300_000, 109_000],  // 14m 19s
      );
      await h.timeout.resolveExpiredMatches(new Date(Date.now() + 120_000));
      expect(h.match(matchId)).toMatchObject({ status: 'FINISHED', winnerId: RYAN, resultType: 'WIN' });
    });

    it('is a DRAW when nobody solved anything', async () => {
      const h = harness();
      const matchId = await expiredBattle(h, [], []);
      await h.timeout.resolveExpiredMatches(new Date(Date.now() + 120_000));
      expect(h.match(matchId)).toMatchObject({ status: 'FINISHED', winnerId: null, resultType: 'DRAW' });
      expect(h.rating.applyMatchRating).toHaveBeenCalledTimes(1);
    });

    it('is a DRAW on an exact tie', async () => {
      const h = harness();
      const matchId = await expiredBattle(h, [1000, 2000], [2500, 500]);
      await h.timeout.resolveExpiredMatches(new Date(Date.now() + 120_000));
      expect(h.match(matchId)).toMatchObject({ status: 'FINISHED', winnerId: null, resultType: 'DRAW' });
    });

    it('does nothing before expiresAt', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);
      await h.timeout.resolveExpiredMatches();
      expect(await h.finalization.resolveTimeout(matchId)).toBe(false);
      expect(h.match(matchId).status).toBe('IN_PROGRESS');
    });

    it('waits, within the grace period, for submissions made before the deadline', async () => {
      const h = harness({ MATCH_JUDGE_GRACE_SECONDS: 60 });
      const { matchId, mcs } = await startPrivateBattle(h);
      const expiresAt = new Date(Date.now() - 1000);
      h.match(matchId).expiresAt = expiresAt;
      h.prisma.seed('submission', [
        {
          userId: RYAN,
          challengeId: 'c',
          matchId,
          matchChallengeId: mcs[0],
          sourceCode: 'x',
          status: 'RUNNING',
          createdAt: new Date(expiresAt.getTime() - 500),
        },
      ]);

      await h.timeout.resolveExpiredMatches(new Date(expiresAt.getTime() + 10_000));
      expect(h.match(matchId).status).toBe('IN_PROGRESS');

      await h.timeout.resolveExpiredMatches(new Date(expiresAt.getTime() + 61_000));
      expect(h.match(matchId)).toMatchObject({ status: 'FINISHED', finishReason: 'TIME_EXPIRED' });
    });

    it('marks submissions stuck in RUNNING as SYSTEM_ERROR, and ignores their late verdict', async () => {
      const h = harness();
      const { matchId, mcs } = await startPrivateBattle(h);
      const [stuck] = h.prisma.seed('submission', [
        {
          userId: RYAN,
          challengeId: 'c',
          matchId,
          matchChallengeId: mcs[0],
          sourceCode: 'x',
          status: 'RUNNING',
          createdAt: new Date(Date.now() - STUCK_SUBMISSION_MS - 1000),
        },
      ]);

      await h.timeout.failStuckSubmissions();
      expect(stuck.status).toBe('SYSTEM_ERROR');

      const job = { tests: [{ id: 't', hidden: false, order: 0 }] } as unknown as RunnerJobPayload;
      const late = await h.results.recordVerdict(stuck.id, accepted(job), 1);
      expect(late.duplicate).toBe(true);
      expect(h.progress(mcs[0], RYAN).status).not.toBe('SOLVED');
    });
  });

  describe('cancellation and disconnects', () => {
    it('cancels without rating', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);

      expect(await h.finalization.cancelMatch(matchId)).toBe(true);
      expect(await h.finalization.cancelMatch(matchId)).toBe(false);

      expect(h.match(matchId)).toMatchObject({ status: 'CANCELLED', finishReason: 'SYSTEM_CANCELLED', winnerId: null });
      expect(h.prisma.rows('room')[0].status).toBe('FINISHED');
      expect(h.rating.applyMatchRating).not.toHaveBeenCalled();
      expect(h.eventsNamed('match:cancelled')).toHaveLength(1);
    });

    it('keeps the match running with no one connected - only the server clock or a player ends it', async () => {
      const h = harness();
      const { matchId } = await startPrivateBattle(h);
      // Nothing in the engine is driven by socket presence: a sweep with the
      // deadline still ahead leaves the match alone.
      await h.timeout.sweep();
      expect(h.match(matchId).status).toBe('IN_PROGRESS');
      expect(h.match(matchId).finishReason).toBeNull();
    });
  });
});
