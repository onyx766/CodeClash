import { Test, TestingModule } from '@nestjs/testing';
import { JudgeMethod, MatchStatus, MatchType } from '@prisma/client';
import { RoundsService } from './rounds.service';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { MatchProgressionService } from '../matches/match-progression.service';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import { NotAMatchParticipantException } from '../../common/exceptions/app.exception';
import type { RunnerJobPayload } from '../challenges/challenge.types';

const HIDDEN_EXPECTATION = [7, 7];

function roundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'round-1',
    matchId: 'match-1',
    challengeId: 'challenge-1',
    roundNumber: 1,
    startedAt: new Date(Date.now() - 1000),
    endsAt: new Date(Date.now() + 60_000),
    finishedAt: null,
    challenge: {
      id: 'challenge-1',
      functionName: 'solve',
      parameters: [
        { name: 'nums', type: 'number[]' },
        { name: 'target', type: 'number' },
      ],
      returnType: 'number[]',
      judgeMethod: JudgeMethod.DEEP_EQUAL,
      referenceSolutionCode: 'function solve() { return []; } // SECRET' as string | null,
      customCheckerCode: null as string | null,
      testGeneratorCode: null as string | null,
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      outputLimitKb: 64,
      testCases: [
        { id: 't1', order: 0, isHidden: false, input: { nums: [2, 7], target: 9 }, expectedOutput: [0, 1] },
        { id: 't2', order: 1, isHidden: true, input: { nums: [7, 7], target: 14 }, expectedOutput: HIDDEN_EXPECTATION },
        { id: 't3', order: 2, isHidden: true, input: { nums: [1], target: 5 }, expectedOutput: [] },
      ],
    },
    match: {
      id: 'match-1',
      status: MatchStatus.IN_PROGRESS,
      currentRoundNumber: 1,
      type: MatchType.QUICK_MATCH,
      participants: [{ userId: 'player-1' }, { userId: 'player-2' }],
      room: null,
    },
    ...overrides,
  };
}

const RUNNER_RESULT = {
  jobId: 'job-1',
  jobType: 'SUBMISSION' as const,
  ok: true,
  passedTests: 2,
  totalTests: 3,
  runtimeMs: 12,
  tests: [
    { testId: 't1', hidden: false, order: 0, status: 'PASSED' as const, runtimeMs: 3 },
    { testId: 't2', hidden: true, order: 1, status: 'PASSED' as const, runtimeMs: 4 },
    {
      testId: 't3',
      hidden: true,
      order: 2,
      status: 'WRONG_ANSWER' as const,
      runtimeMs: 5,
      message: 'Expected [] but received [7,7]',
    },
  ],
};

describe('RoundsService', () => {
  let service: RoundsService;
  let prisma: any;
  let runner: { submit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      round: { findUnique: jest.fn().mockResolvedValue(roundRow()) },
      submission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'submission-1',
          submittedAt: new Date(),
        }),
      },
    };
    runner = { submit: jest.fn().mockResolvedValue(RUNNER_RESULT) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SocketGateway, useValue: { emitToUser: jest.fn() } },
        { provide: MatchProgressionService, useValue: { maybeCloseRound: jest.fn() } },
        { provide: JudgeRunnerClient, useValue: runner },
      ],
    }).compile();

    service = module.get(RoundsService);
  });

  it('refuses a user who is not in the match', async () => {
    await expect(
      service.runCode('stranger', 'round-1', 'function solve() {}'),
    ).rejects.toBeInstanceOf(NotAMatchParticipantException);
    expect(runner.submit).not.toHaveBeenCalled();
  });

  describe('practice run', () => {
    it('sends only public tests', async () => {
      await service.runCode('player-1', 'round-1', 'function solve() {}');

      const payload: RunnerJobPayload = runner.submit.mock.calls[0][0];
      expect(payload.jobType).toBe('SUBMISSION');
      expect(payload.tests).toHaveLength(1);
      expect(payload.tests[0].hidden).toBe(false);
      // No generated tests on the unscored path.
      expect(payload.generatorSeeds).toBeUndefined();
    });
  });

  describe('scored submission', () => {
    it('sends public AND hidden tests to the runner', async () => {
      await service.submitCode('player-1', 'round-1', 'function solve() {}');

      const payload: RunnerJobPayload = runner.submit.mock.calls[0][0];
      expect(payload.tests).toHaveLength(3);
      expect(payload.tests.filter((t) => t.hidden)).toHaveLength(2);
      expect(payload.sourceCode).toBe('function solve() {}');
      expect(payload.judgeMethod).toBe(JudgeMethod.DEEP_EQUAL);
      expect(payload.functionContract.parameters).toHaveLength(2);
    });

    it('scores from the runner counts, not from anything the client sent', async () => {
      await service.submitCode('player-1', 'round-1', 'function solve() {}');

      const created = prisma.submission.create.mock.calls[0][0].data;
      expect(created.passedTests).toBe(2);
      expect(created.totalTests).toBe(3);
      expect(created.score).toBe(Math.round((2 / 3) * 700));
    });

    it('never returns hidden inputs, expectations or messages to the player', async () => {
      const result = await service.submitCode(
        'player-1',
        'round-1',
        'function solve() {}',
      );

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('SECRET');
      expect(serialized).not.toContain('Expected [] but received');
      expect(serialized).not.toContain('"nums"');

      const hidden = result.results.results.filter((r) => r.hidden);
      expect(hidden).toHaveLength(2);
      for (const test of hidden) {
        expect(test.message).toBeNull();
        expect(test.order).toBeNull();
        expect(test).not.toHaveProperty('input');
        expect(test).not.toHaveProperty('expectedOutput');
      }
      // A player still learns pass/fail per hidden test, which is the point.
      expect(hidden.map((t) => t.status)).toEqual(['PASSED', 'WRONG_ANSWER']);
    });

    it('keeps public test detail visible', async () => {
      const result = await service.submitCode(
        'player-1',
        'round-1',
        'function solve() {}',
      );
      const publicResult = result.results.results.find((r) => !r.hidden)!;
      expect(publicResult.order).toBe(0);
      expect(publicResult.passed).toBe(true);
    });

    it('adds deterministic generated tests only with both a generator and a reference', async () => {
      const withGenerator = roundRow();
      withGenerator.challenge.testGeneratorCode =
        'function generate(seed) { return { nums: [seed], target: seed }; }';
      prisma.round.findUnique.mockResolvedValue(withGenerator);

      await service.submitCode('player-1', 'round-1', 'function solve() {}');
      const first: RunnerJobPayload = runner.submit.mock.calls[0][0];
      expect(first.generatorSeeds).toHaveLength(5);

      // Same challenge + round => same seeds, so both players face the same
      // generated tests and a re-run reproduces them.
      runner.submit.mockClear();
      await service.submitCode('player-2', 'round-1', 'function solve() {}');
      expect(
        (runner.submit.mock.calls[0][0] as RunnerJobPayload).generatorSeeds,
      ).toEqual(first.generatorSeeds);
    });

    it('omits seeds when the challenge has a generator but no reference solution', async () => {
      const noReference = roundRow();
      noReference.challenge.testGeneratorCode = 'function generate(seed) { return {}; }';
      noReference.challenge.referenceSolutionCode = null;
      prisma.round.findUnique.mockResolvedValue(noReference);

      await service.submitCode('player-1', 'round-1', 'function solve() {}');
      expect(
        (runner.submit.mock.calls[0][0] as RunnerJobPayload).generatorSeeds,
      ).toBeUndefined();
    });
  });
});
