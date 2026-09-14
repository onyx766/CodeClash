import { Injectable } from '@nestjs/common';
import {
  MatchChallengeStatus,
  MatchFinishReason,
  MatchStatus,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { SocketEvents } from '../../socket/socket.events';
import type { RunnerJobResult } from '../challenges/challenge.types';
import { MatchFinalizationService } from '../matches/match-finalization.service';
import { MatchStandings, loadStandings, win } from '../matches/match-standings';
import { deriveSubmissionStatus, extractMetrics } from './submission-judge.util';

export const PENDING_SUBMISSION_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.QUEUED,
  SubmissionStatus.RUNNING,
];

export interface VerdictOutcome {
  submissionId: string;
  status: SubmissionStatus;
  /** True when this verdict had already been recorded - nothing was changed. */
  duplicate: boolean;
  /** True only for the verdict that moved this player's progress to SOLVED. */
  newlySolved: boolean;
  /** True only for the verdict that ended the match. */
  finished: boolean;
  matchId: string | null;
  matchChallengeId: string | null;
  challengeId: string | null;
  userId: string | null;
  standings?: MatchStandings;
}

/**
 * The single place a runner verdict turns into match progress.
 *
 * Idempotent: the Submission moves out of QUEUED/RUNNING through a conditional
 * update, so delivering the same verdict twice (a retried request, a future
 * async callback) changes nothing the second time - no second solve, no second
 * finish, no second rating.
 *
 * Everything runs in one transaction holding the Match row lock, which is what
 * makes simultaneous final submissions deterministic:
 *
 *   Policy: solvedAt is the moment the backend commits the ACCEPTED verdict,
 *   and a match is won by the player whose last ACCEPTED verdict commits
 *   first. Verdicts for one match are serialized by the row lock, so of two
 *   near-simultaneous fifth solves exactly one reaches finalizeInTx with the
 *   match still IN_PROGRESS. The other verdict is still stored on its
 *   Submission, but the match is already FINISHED, so it changes no progress.
 *
 * A verdict never counts once the match has ended, for a player who gave up,
 * or for a submission created after expiresAt. The first ACCEPTED verdict
 * locks solvedAt/solveDurationMs/bestSubmissionId in place; a later faster
 * solution cannot improve them.
 */
@Injectable()
export class RunnerResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finalization: MatchFinalizationService,
    private readonly socket: SocketGateway,
  ) {}

  async recordVerdict(
    submissionId: string,
    result: RunnerJobResult,
    expectedTestCount: number,
  ): Promise<VerdictOutcome> {
    const status = deriveSubmissionStatus(result, expectedTestCount);
    const metrics = extractMetrics(result);

    const outcome = await this.prisma.$transaction(async (tx): Promise<VerdictOutcome> => {
      const submission = await tx.submission.findUnique({
        where: { id: submissionId },
        select: {
          id: true,
          userId: true,
          challengeId: true,
          matchId: true,
          matchChallengeId: true,
          createdAt: true,
        },
      });
      if (!submission) throw new Error(`Submission ${submissionId} does not exist.`);
      if (submission.matchId) await this.finalization.lockMatch(tx, submission.matchId);

      const base: VerdictOutcome = {
        submissionId,
        status,
        duplicate: false,
        newlySolved: false,
        finished: false,
        matchId: submission.matchId,
        matchChallengeId: submission.matchChallengeId,
        challengeId: submission.challengeId,
        userId: submission.userId,
      };

      const now = new Date();
      const claim = await tx.submission.updateMany({
        where: { id: submissionId, status: { in: PENDING_SUBMISSION_STATUSES } },
        data: { status, ...metrics, completedAt: now },
      });
      if (claim.count !== 1) {
        const recorded = await tx.submission.findUnique({
          where: { id: submissionId },
          select: { status: true },
        });
        return { ...base, status: recorded!.status, duplicate: true };
      }

      if (
        status !== SubmissionStatus.ACCEPTED ||
        !submission.matchId ||
        !submission.matchChallengeId
      ) {
        return base;
      }

      const match = await tx.match.findUnique({
        where: { id: submission.matchId },
        select: {
          status: true,
          startedAt: true,
          expiresAt: true,
          participants: { select: { userId: true, gaveUpAt: true } },
        },
      });
      const player = match?.participants.find((p) => p.userId === submission.userId);
      const counts =
        !!match &&
        match.status === MatchStatus.IN_PROGRESS &&
        !!match.startedAt &&
        !!player &&
        !player.gaveUpAt &&
        (!match.expiresAt || submission.createdAt.getTime() <= match.expiresAt.getTime());
      if (!counts) return base;

      const solve = await tx.matchChallengeProgress.updateMany({
        where: {
          matchChallengeId: submission.matchChallengeId,
          userId: submission.userId,
          status: { not: MatchChallengeStatus.SOLVED },
        },
        data: {
          status: MatchChallengeStatus.SOLVED,
          solvedAt: now,
          solveDurationMs: now.getTime() - match!.startedAt!.getTime(),
          bestSubmissionId: submissionId,
        },
      });
      if (solve.count !== 1) return base;

      const standings = await loadStandings(tx, submission.matchId);
      const mine = standings.players.find((p) => p.userId === submission.userId);
      const finished =
        !!mine && standings.total > 0 && mine.solved >= standings.total
          ? await this.finalization.finalizeInTx(tx, {
              matchId: submission.matchId,
              reason: MatchFinishReason.ALL_CHALLENGES_SOLVED,
              decision: win(submission.userId),
            })
          : false;

      return { ...base, newlySolved: true, finished, standings };
    });

    if (outcome.newlySolved) this.announceSolve(outcome);
    if (outcome.finished) await this.finalization.afterFinish(outcome.matchId!);
    return outcome;
  }

  /** The runner could not be reached or failed outright. */
  async recordSystemError(submissionId: string): Promise<void> {
    await this.prisma.submission.updateMany({
      where: { id: submissionId, status: { in: PENDING_SUBMISSION_STATUSES } },
      data: { status: SubmissionStatus.SYSTEM_ERROR, completedAt: new Date() },
    });
  }

  /** Counts and ids only - never source code, test data or runner output. */
  private announceSolve(outcome: VerdictOutcome) {
    const standings = outcome.standings!;
    const mine = standings.players.find((p) => p.userId === outcome.userId);
    this.socket.emitToMatch(outcome.matchId!, SocketEvents.CHALLENGE_SOLVED, {
      matchId: outcome.matchId,
      userId: outcome.userId,
      matchChallengeId: outcome.matchChallengeId,
      challengeId: outcome.challengeId,
      solvedCount: mine?.solved ?? 0,
      totalChallenges: standings.total,
    });
    this.socket.emitToMatch(outcome.matchId!, SocketEvents.MATCH_PROGRESS, {
      matchId: outcome.matchId,
      players: standings.players.map((p) => ({
        userId: p.userId,
        solved: p.solved,
        total: p.total,
      })),
    });
  }
}
