import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MatchStatus, MatchType } from '@prisma/client';
import axios from 'axios';
import { RoundsService } from './rounds.service';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { MatchProgressionService } from '../matches/match-progression.service';
import { SocketEvents } from '../../socket/socket.events';
import {
  AlreadySubmittedException,
  NotAMatchParticipantException,
  RoundNotOpenException,
} from '../../common/exceptions/app.exception';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const ROUND_ID = 'round-1';
const P1 = 'player-1';
const P2 = 'player-2';
const OUTSIDER = 'nosy-stranger';

describe('RoundsService', () => {
  let service: RoundsService;
  let prisma: {
    round: { findUnique: jest.Mock };
    submission: { findUnique: jest.Mock; create: jest.Mock };
  };
  let socket: { emitToUser: jest.Mock };
  let progression: { maybeCloseRound: jest.Mock };

  function round(overrides: Record<string, any> = {}) {
    return {
      id: ROUND_ID,
      matchId: 'match-1',
      roundNumber: 1,
      startedAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 60_000),
      finishedAt: null,
      challenge: {
        id: 'c1',
        functionName: 'solve',
        timeLimitSeconds: 300,
        testCases: [
          { input: '[1,2]', expectedOutput: '3', isHidden: false },
          { input: '[9,9]', expectedOutput: '18', isHidden: true },
        ],
      },
      match: {
        id: 'match-1',
        type: MatchType.QUICK_MATCH,
        status: MatchStatus.IN_PROGRESS,
        currentRoundNumber: 1,
        participants: [{ userId: P1 }, { userId: P2 }],
        room: null,
      },
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      round: { findUnique: jest.fn().mockResolvedValue(round()) },
      submission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'sub-1', submittedAt: new Date(), ...data }),
        ),
      },
    };
    socket = { emitToUser: jest.fn() };
    progression = { maybeCloseRound: jest.fn().mockResolvedValue(undefined) };

    mockedAxios.post.mockResolvedValue({
      data: { passedTests: 2, totalTests: 2, runtimeMs: 12 },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'http://runner:5000' } },
        { provide: SocketGateway, useValue: socket },
        { provide: MatchProgressionService, useValue: progression },
      ],
    }).compile();

    service = module.get(RoundsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('authorization', () => {
    it('refuses a submission from someone who is not in the match', async () => {
      await expect(service.submitCode(OUTSIDER, ROUND_ID, 'x')).rejects.toBeInstanceOf(
        NotAMatchParticipantException,
      );
      expect(prisma.submission.create).not.toHaveBeenCalled();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('refuses a practice run from someone who is not in the match', async () => {
      await expect(service.runCode(OUTSIDER, ROUND_ID, 'x')).rejects.toBeInstanceOf(
        NotAMatchParticipantException,
      );
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('authorizes private-room players from room.players', async () => {
      prisma.round.findUnique.mockResolvedValue(
        round({
          match: {
            id: 'match-1',
            type: MatchType.PRIVATE_ROOM,
            status: MatchStatus.IN_PROGRESS,
            currentRoundNumber: 1,
            participants: [],
            room: { players: [{ userId: P1 }, { userId: P2 }] },
          },
        }),
      );

      await expect(service.submitCode(P1, ROUND_ID, 'x')).resolves.toBeDefined();
    });
  });

  describe('round state guards', () => {
    it.each([
      ['the match is not in progress', { match: { ...round().match, status: MatchStatus.FINISHED } }],
      ['the round already finished', { finishedAt: new Date() }],
      ['the deadline has passed', { endsAt: new Date(Date.now() - 1) }],
      ['the round has not started', { startedAt: null }],
      [
        'it is not the current round',
        { match: { ...round().match, currentRoundNumber: 2 } },
      ],
    ])('rejects a submission when %s', async (_label, overrides) => {
      prisma.round.findUnique.mockResolvedValue(round(overrides));

      await expect(service.submitCode(P1, ROUND_ID, 'x')).rejects.toBeInstanceOf(
        RoundNotOpenException,
      );
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });

    it('rejects a second submission from the same player', async () => {
      prisma.submission.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.submitCode(P1, ROUND_ID, 'x')).rejects.toBeInstanceOf(
        AlreadySubmittedException,
      );
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });
  });

  describe('test case exposure', () => {
    it('runs practice against public test cases only', async () => {
      await service.runCode(P1, ROUND_ID, 'x');

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.testCases).toEqual([{ input: '[1,2]', expectedOutput: '3' }]);
    });

    it('grades a submission against every test case, including hidden ones', async () => {
      await service.submitCode(P1, ROUND_ID, 'x');

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.testCases).toHaveLength(2);
      expect(body.testCases).toContainEqual({ input: '[9,9]', expectedOutput: '18' });
    });
  });

  describe('scoring and notification', () => {
    it('scores from the runner counts, not from anything the client sent', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { passedTests: 1, totalTests: 2, runtimeMs: 7, score: 999999 },
      });

      const res = await service.submitCode(P1, ROUND_ID, 'x');

      expect(res.submission.score).toBe(350); // 1/2 * 700
      expect(prisma.submission.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ score: 350 }) }),
      );
    });

    it('tells the opponent a submission landed without leaking the score', async () => {
      await service.submitCode(P1, ROUND_ID, 'x');

      const opponentEvents = socket.emitToUser.mock.calls.filter(
        ([userId]) => userId === P2,
      );
      expect(opponentEvents).toHaveLength(1);
      expect(opponentEvents[0][1]).toBe(SocketEvents.ROUND_OPPONENT_SUBMITTED);
      expect(opponentEvents[0][2]).not.toHaveProperty('score');
      expect(opponentEvents[0][2]).not.toHaveProperty('passedTests');
    });

    it('asks the progression service to close the round after submitting', async () => {
      await service.submitCode(P1, ROUND_ID, 'x');
      expect(progression.maybeCloseRound).toHaveBeenCalledWith(ROUND_ID);
    });
  });
});
