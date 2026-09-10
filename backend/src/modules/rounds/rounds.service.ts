import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MatchStatus, MatchType } from '@prisma/client';
import type { Challenge, ChallengeTestCase } from '@prisma/client';
import { createHash } from 'crypto';
import { SocketGateway } from '../../socket/socket.gateway';
import { SocketEvents } from '../../socket/socket.events';
import { MatchProgressionService } from '../matches/match-progression.service';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import type {
  FunctionParameter,
  JsonValue,
  RunnerJobPayload,
  RunnerJobResult,
  RunnerTestCase,
} from '../challenges/challenge.types';
import {
  NotAMatchParticipantException,
  RoundNotOpenException,
  AlreadySubmittedException,
} from '../../common/exceptions/app.exception';

/** How many deterministic generated tests a scored submission adds, at most. */
const GENERATED_TEST_COUNT = 5;

@Injectable()
export class RoundsService {
  constructor(
    private prisma: PrismaService,
    private socket: SocketGateway,
    private progression: MatchProgressionService,
    private runner: JudgeRunnerClient,
  ) {}

  private loadRound(roundId: string) {
    return this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        challenge: { include: { testCases: true } },
        match: {
          include: { participants: true, room: { include: { players: true } } },
        },
      },
    });
  }

  /**
   * Authorization for anything that touches a round. Without this, an
   * authenticated user could run or submit code against any round id in the
   * system - including a stranger's live match - and, for submit, write a
   * Submission row that decides someone else's result.
   *
   * Returns the round; throws if this user has no business being here.
   */
  private async authorizeRound(userId: string, roundId: string) {
    const round = await this.loadRound(roundId);
    if (!round) throw new BadRequestException('Round not found');

    const players =
      round.match.type === MatchType.QUICK_MATCH
        ? round.match.participants.map((p) => p.userId)
        : round.match.room?.players.map((p) => p.userId) ?? [];
    if (!players.includes(userId)) throw new NotAMatchParticipantException();

    return { round, players };
  }

  /**
   * Practice run against the PUBLIC test cases only. Unlimited, never scored,
   * never writes a Submission. Hidden test cases are deliberately excluded -
   * they are the only thing stopping a player from probing the grader until
   * they can hardcode its answers.
   */
  async runCode(userId: string, roundId: string, code: string) {
    const { round } = await this.authorizeRound(userId, roundId);
    if (round.match.status !== MatchStatus.IN_PROGRESS) {
      throw new RoundNotOpenException('This match is not in progress.');
    }
    if (round.finishedAt) {
      throw new RoundNotOpenException('This round has already finished.');
    }

    const publicTests = round.challenge.testCases.filter((t) => !t.isHidden);

    const result = await this.runner.submit(
      this.buildSubmissionJob(round.challenge, publicTests, code, {
        userId,
        roundId,
        matchId: round.matchId,
      }),
    );

    return this.toClientResult(result, publicTests);
  }

  /**
   * The scoring path: runs against ALL test cases (public and hidden) and
   * writes the one Submission this player gets for this round. Grading always
   * happens server-side against test cases the browser has never seen.
   */
  async submitCode(userId: string, roundId: string, code: string) {
    const { round, players } = await this.authorizeRound(userId, roundId);

    if (round.match.status !== MatchStatus.IN_PROGRESS) {
      throw new RoundNotOpenException('This match is not in progress.');
    }
    if (round.finishedAt) {
      throw new RoundNotOpenException('This round has already finished.');
    }
    if (round.roundNumber !== round.match.currentRoundNumber) {
      throw new RoundNotOpenException('This is not the current round.');
    }
    if (!round.startedAt) {
      throw new RoundNotOpenException('This round has not started yet.');
    }
    if (round.endsAt && round.endsAt.getTime() <= Date.now()) {
      throw new RoundNotOpenException('Time is up for this round.');
    }

    // One scoring submission per player per round - the round closes as soon
    // as both have submitted, so a retry would have nothing to decide. The
    // @@unique([roundId, userId]) index backs this up against a double-submit
    // that races this check.
    const existing = await this.prisma.submission.findUnique({
      where: { roundId_userId: { roundId, userId } },
    });
    if (existing) throw new AlreadySubmittedException();

    // Public AND hidden test cases. Hidden cases only ever travel
    // NestJS -> runner; they are never part of any response to a browser.
    const allTests = round.challenge.testCases;
    const result = await this.runner.submit(
      this.buildSubmissionJob(round.challenge, allTests, code, {
        userId,
        roundId,
        matchId: round.matchId,
      }),
    );

    const passedTests = Number(result.passedTests ?? 0);
    const totalTests = Number(result.totalTests ?? allTests.length);
    const runtimeMs = Math.round(Number(result.runtimeMs ?? 0));

    // Scoring is correctness-only for now; speed/efficiency bonuses are a
    // later feature. Computed here from the runner's counts, never from
    // anything the client sent.
    const score = Math.round((passedTests / Math.max(1, totalTests)) * 700);

    const submission = await this.prisma.submission.create({
      data: { userId, roundId, code, passedTests, totalTests, runtimeMs, score },
    });

    this.socket.emitToUser(userId, SocketEvents.SUBMISSION_RESULT, {
      matchId: round.matchId,
      roundId,
      submissionId: submission.id,
      passedTests,
      totalTests,
      runtimeMs,
      score,
    });

    // The opponent learns that a submission landed, but not how it scored -
    // the round is still open and that would be live intelligence.
    for (const opponentId of players.filter((id) => id !== userId)) {
      this.socket.emitToUser(opponentId, SocketEvents.ROUND_OPPONENT_SUBMITTED, {
        matchId: round.matchId,
        roundId,
      });
    }

    // Closes the round if this was the second submission; a no-op otherwise.
    await this.progression.maybeCloseRound(roundId);

    return {
      submission: {
        id: submission.id,
        passedTests,
        totalTests,
        runtimeMs,
        score,
        submittedAt: submission.submittedAt,
      },
      results: this.toClientResult(result, allTests),
    };
  }

  // -------------------------------------------------------------------------
  // runner protocol
  // -------------------------------------------------------------------------

  /**
   * Builds the SUBMISSION job. The player's code, the challenge's reference
   * solution and its custom checker all travel to the runner as opaque strings;
   * none of them is ever executed in this process.
   */
  private buildSubmissionJob(
    challenge: Challenge,
    testCases: ChallengeTestCase[],
    sourceCode: string,
    metadata: { userId: string; roundId: string; matchId: string },
  ): RunnerJobPayload {
    const tests: RunnerTestCase[] = [...testCases]
      .sort((a, b) => a.order - b.order)
      .map((testCase) => ({
        id: testCase.id,
        input: testCase.input as JsonValue,
        expectedOutput:
          testCase.expectedOutput === null
            ? undefined
            : (testCase.expectedOutput as JsonValue),
        hidden: testCase.isHidden,
        order: testCase.order,
      }));

    // Generated tests need both a deterministic generator and a reference
    // solution to derive the expected output from, and are only added to a
    // scored run - never to a practice run against public tests.
    const useGenerator =
      !!challenge.testGeneratorCode &&
      !!challenge.referenceSolutionCode &&
      tests.some((test) => test.hidden);

    return {
      jobType: 'SUBMISSION',
      challengeId: challenge.id,
      language: 'javascript',
      sourceCode,
      functionContract: {
        functionName: challenge.functionName,
        parameters: (challenge.parameters as unknown as FunctionParameter[]) ?? [],
        returnType: challenge.returnType,
      },
      judgeMethod: challenge.judgeMethod,
      referenceSolutionCode: challenge.referenceSolutionCode,
      customCheckerCode: challenge.customCheckerCode,
      generatorCode: challenge.testGeneratorCode,
      limits: {
        timeLimitMs: challenge.timeLimitMs,
        memoryLimitMb: challenge.memoryLimitMb,
        outputLimitKb: challenge.outputLimitKb,
      },
      tests,
      generatorSeeds: useGenerator
        ? this.deterministicSeeds(`${challenge.id}:${metadata.roundId}`)
        : undefined,
      metadata,
    };
  }

  /**
   * Seeds derived from the challenge and round, so both players in a round face
   * exactly the same generated tests and a re-run reproduces them.
   */
  private deterministicSeeds(key: string): number[] {
    const digest = createHash('sha256').update(key).digest();
    return Array.from({ length: GENERATED_TEST_COUNT }, (_, index) =>
      digest.readUInt32BE(index * 4),
    );
  }

  /**
   * Player-safe view of a runner result. Hidden tests are reduced to a
   * pass/fail status with no input, no expected value and no message - the
   * message can contain checker output that describes the expectation.
   */
  private toClientResult(
    result: RunnerJobResult,
    testCases: ChallengeTestCase[],
  ) {
    const publicOrder = new Map(
      testCases.filter((t) => !t.isHidden).map((t) => [t.id, t.order]),
    );

    return {
      passedTests: result.passedTests ?? 0,
      totalTests: result.totalTests ?? testCases.length,
      runtimeMs: result.runtimeMs ?? 0,
      results: (result.tests ?? []).map((test) => ({
        hidden: test.hidden,
        // Public tests are identifiable so the UI can line them up with the
        // samples it already has; hidden ones stay anonymous.
        order: test.hidden ? null : (publicOrder.get(test.testId) ?? test.order),
        status: test.status,
        passed: test.status === 'PASSED',
        runtimeMs: test.runtimeMs,
        memoryKb: test.memoryKb ?? null,
        message: test.hidden ? null : (test.message ?? null),
      })),
    };
  }
}
