import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MatchStatus, MatchType } from '@prisma/client';
import axios from 'axios';
import { SocketGateway } from '../../socket/socket.gateway';
import { SocketEvents } from '../../socket/socket.events';
import { MatchProgressionService } from '../matches/match-progression.service';
import {
  NotAMatchParticipantException,
  RoundNotOpenException,
  AlreadySubmittedException,
} from '../../common/exceptions/app.exception';

/**
 * Wall-clock budget for executing one submission inside the sandbox.
 *
 * Deliberately NOT Challenge.timeLimitSeconds: that field is the round's
 * duration (how long players have to write a solution, default 300s) and is
 * what Round.endsAt is derived from. Handing it to the runner as an execution
 * timeout would let a single submission occupy a sandbox for the entire round.
 */
const EXECUTION_TIMEOUT_SECONDS = 5;

@Injectable()
export class RoundsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private socket: SocketGateway,
    private progression: MatchProgressionService,
  ) {}

  private getRunnerUrl() {
    return this.config.get<string>('CODE_RUNNER_URL') || 'http://localhost:5000';
  }

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

    const publicTests = round.challenge.testCases
      .filter((t) => !t.isHidden)
      .map((t) => ({ input: t.input, expectedOutput: t.expectedOutput }));

    const res = await axios.post(`${this.getRunnerUrl()}/run`, {
      code,
      testCases: publicTests,
      functionName: round.challenge.functionName,
      timeLimitSeconds: EXECUTION_TIMEOUT_SECONDS,
      metadata: { userId, roundId, matchId: round.matchId },
    });
    return res.data;
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

    const allTests = round.challenge.testCases.map((t) => ({
      input: t.input,
      expectedOutput: t.expectedOutput,
    }));
    const res = await axios.post(`${this.getRunnerUrl()}/run`, {
      code,
      testCases: allTests,
      functionName: round.challenge.functionName,
      timeLimitSeconds: EXECUTION_TIMEOUT_SECONDS,
      metadata: { userId, roundId, matchId: round.matchId },
    });

    const passedTests = Number(res.data?.passedTests ?? 0);
    const totalTests = Number(res.data?.totalTests ?? allTests.length);
    const runtimeMs = Math.round(Number(res.data?.runtimeMs ?? 0));

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
      results: res.data,
    };
  }
}
