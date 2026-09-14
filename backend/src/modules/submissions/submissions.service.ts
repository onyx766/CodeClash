import { Injectable, Logger } from '@nestjs/common';
import { MatchChallengeStatus, MatchStatus, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { SocketEvents } from '../../socket/socket.events';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import type { RunnerJobPayload, RunnerJobResult } from '../challenges/challenge.types';
import {
  AlreadySolvedException,
  MatchAccessDeniedException,
  MatchAlreadyFinishedException,
  MatchChallengeNotFoundException,
  MatchExpiredException,
  MatchNotActiveException,
  MatchNotFoundException,
  PlayerAlreadyGaveUpException,
  RunnerUnavailableException,
} from '../../common/exceptions/app.exception';
import { RunnerResultService } from './runner-result.service';
import { buildJudgeJob, toClientResult } from './submission-judge.util';

/**
 * Run Tests and Submit for a match challenge. Players may work on the match's
 * challenges in any order - nothing here depends on position or on which
 * challenge the player opened last.
 *
 * Nothing the client sends decides an outcome: the request carries only the
 * source code; solved state, counts and the match result come from the
 * runner's verdict via RunnerResultService.
 */
@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: JudgeRunnerClient,
    private readonly results: RunnerResultService,
    private readonly socket: SocketGateway,
  ) {}

  /**
   * Public tests only. Never writes a Submission and never solves anything;
   * it does mark the challenge ATTEMPTING the first time.
   */
  async runTests(userId: string, matchId: string, matchChallengeId: string, code: string) {
    const mc = await this.loadPlayable(userId, matchId, matchChallengeId);
    await this.markAttempt(matchId, mc.id, userId, false);

    const publicTests = mc.challenge.testCases.filter((t) => !t.isHidden);
    const result = await this.judge(
      buildJudgeJob(mc.challenge, publicTests, code, {
        seedKey: mc.id,
        metadata: { kind: 'RUN', userId, matchId, matchChallengeId: mc.id },
      }),
    );
    return { success: true, run: toClientResult(result, publicTests) };
  }

  /** Public AND hidden tests. The only path that can solve a challenge. */
  async submit(userId: string, matchId: string, matchChallengeId: string, code: string) {
    const mc = await this.loadPlayable(userId, matchId, matchChallengeId);

    const progress = await this.prisma.matchChallengeProgress.findUnique({
      where: { matchChallengeId_userId: { matchChallengeId: mc.id, userId } },
      select: { status: true },
    });
    if (progress?.status === MatchChallengeStatus.SOLVED) throw new AlreadySolvedException();

    const submission = await this.prisma.submission.create({
      data: {
        userId,
        challengeId: mc.challengeId,
        matchId,
        matchChallengeId: mc.id,
        sourceCode: code,
        language: 'javascript',
        status: SubmissionStatus.RUNNING,
      },
      select: { id: true, createdAt: true },
    });
    await this.markAttempt(matchId, mc.id, userId, true);

    // Hidden cases only ever travel NestJS -> runner; they are never part of
    // any response to a browser.
    const allTests = mc.challenge.testCases;
    let result: RunnerJobResult;
    try {
      result = await this.runner.submit(
        buildJudgeJob(mc.challenge, allTests, code, {
          seedKey: mc.id,
          submissionId: submission.id,
          metadata: { kind: 'SUBMIT', userId, matchId, matchChallengeId: mc.id, submissionId: submission.id },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Runner failed for submission ${submission.id}: ${err instanceof Error ? err.message : err}`,
      );
      await this.results.recordSystemError(submission.id);
      throw new RunnerUnavailableException();
    }

    const verdict = await this.results.recordVerdict(submission.id, result, allTests.length);
    const stored = await this.prisma.submission.findUnique({
      where: { id: submission.id },
      select: {
        id: true,
        status: true,
        passedTests: true,
        totalTests: true,
        runtimeMs: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return {
      success: true,
      submission: stored,
      solved: verdict.newlySolved,
      matchFinished: verdict.finished,
      results: toClientResult(result, allTests),
    };
  }

  private async loadPlayable(userId: string, matchId: string, matchChallengeId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true },
    });
    if (!match) throw new MatchNotFoundException();
    const me = match.participants.find((p) => p.userId === userId);
    if (!me) throw new MatchAccessDeniedException();

    if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED) {
      throw new MatchAlreadyFinishedException();
    }
    if (match.status !== MatchStatus.IN_PROGRESS) throw new MatchNotActiveException();
    if (me.gaveUpAt) throw new PlayerAlreadyGaveUpException();
    if (match.expiresAt && match.expiresAt.getTime() <= Date.now()) {
      throw new MatchExpiredException();
    }

    const mc = await this.prisma.matchChallenge.findFirst({
      where: { id: matchChallengeId, matchId },
      include: { challenge: { include: { testCases: true } } },
    });
    if (!mc) throw new MatchChallengeNotFoundException();
    return mc;
  }

  /**
   * NOT_STARTED -> ATTEMPTING on the first Run/Submit (the opponent is told);
   * scored submissions also bump the attempt counter.
   */
  private async markAttempt(
    matchId: string,
    matchChallengeId: string,
    userId: string,
    countAttempt: boolean,
  ) {
    const started = await this.prisma.matchChallengeProgress.updateMany({
      where: { matchChallengeId, userId, status: MatchChallengeStatus.NOT_STARTED },
      data: {
        status: MatchChallengeStatus.ATTEMPTING,
        firstAttemptAt: new Date(),
        ...(countAttempt ? { attempts: { increment: 1 } } : {}),
      },
    });
    if (started.count === 1) {
      this.socket.emitToMatch(matchId, SocketEvents.CHALLENGE_ATTEMPTING, {
        matchId,
        userId,
        matchChallengeId,
      });
      return;
    }
    if (countAttempt) {
      await this.prisma.matchChallengeProgress.updateMany({
        where: { matchChallengeId, userId },
        data: { attempts: { increment: 1 } },
      });
    }
  }

  private async judge(payload: RunnerJobPayload): Promise<RunnerJobResult> {
    try {
      return await this.runner.submit(payload);
    } catch (err) {
      this.logger.warn(`Runner failed for a test run: ${err instanceof Error ? err.message : err}`);
      throw new RunnerUnavailableException();
    }
  }
}
