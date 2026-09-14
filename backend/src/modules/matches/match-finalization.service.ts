import { Injectable, Logger } from '@nestjs/common';
import { MatchFinishReason, MatchStatus, Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { SocketEvents } from '../../socket/socket.events';
import { RatingResult, RatingService } from '../rating/rating.service';
import {
  MatchAccessDeniedException,
  MatchAlreadyFinishedException,
  MatchExpiredException,
  MatchNotActiveException,
  MatchNotFoundException,
} from '../../common/exceptions/app.exception';
import { MatchDecision, decideTimeoutResult, loadStandings, win } from './match-standings';

export const ACTIVE_MATCH_STATUSES: MatchStatus[] = [
  MatchStatus.PENDING,
  MatchStatus.PENDING_READY,
  MatchStatus.READY,
  MatchStatus.IN_PROGRESS,
];

export interface FinishParams {
  matchId: string;
  reason: MatchFinishReason;
  decision: MatchDecision;
}

/**
 * The only code that ends a match. Every trigger - fifth accepted solve
 * (RunnerResultService), give up, timeout (MatchTimeoutService), admin/system
 * cancel - comes through here.
 *
 * Concurrency model: each trigger runs in a transaction that first takes
 * `SELECT ... FOR UPDATE` on the Match row, so triggers for one match are
 * serialized by PostgreSQL. The status transition itself is also a
 * conditional update on IN_PROGRESS, so whichever trigger commits first ends
 * the match and every later one observes count 0 and changes nothing - there
 * can never be two FINISHED writes with different winners.
 *
 * Rating runs after the commit (RatingService owns its own transaction and is
 * idempotent via ratingProcessedAt); a failure there leaves the result intact
 * and MatchTimeoutService retries it.
 */
@Injectable()
export class MatchFinalizationService {
  private readonly logger = new Logger(MatchFinalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
    private readonly rating: RatingService,
  ) {}

  async lockMatch(tx: Prisma.TransactionClient, matchId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${matchId} FOR UPDATE`;
  }

  /**
   * Caller must hold the Match row lock (see lockMatch). Returns true only for
   * the one caller that actually moved the match out of IN_PROGRESS; the
   * caller then runs afterFinish once its transaction has committed.
   */
  async finalizeInTx(tx: Prisma.TransactionClient, params: FinishParams): Promise<boolean> {
    const claim = await tx.match.updateMany({
      where: { id: params.matchId, status: MatchStatus.IN_PROGRESS },
      data: {
        status: MatchStatus.FINISHED,
        winnerId: params.decision.winnerId,
        resultType: params.decision.resultType,
        finishReason: params.reason,
        finishedAt: new Date(),
      },
    });
    if (claim.count !== 1) return false;
    await this.closeRoom(tx, params.matchId);
    return true;
  }

  /** Post-commit side effects of a finish: rating, then the realtime event. */
  async afterFinish(matchId: string): Promise<void> {
    const rating = await this.applyRatingSafely(matchId);
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        winnerId: true,
        resultType: true,
        finishReason: true,
        ratingEligible: true,
        finishedAt: true,
      },
    });
    if (!match) return;
    const standings = await loadStandings(this.prisma, matchId);

    this.socket.emitToMatch(matchId, SocketEvents.MATCH_FINISHED, {
      matchId,
      status: match.status,
      winnerId: match.winnerId,
      resultType: match.resultType,
      finishReason: match.finishReason,
      ratingEligible: match.ratingEligible,
      finishedAt: match.finishedAt,
      players: standings.players.map((p) => ({
        userId: p.userId,
        solved: p.solved,
        total: p.total,
        totalSolveDurationMs: p.totalSolveDurationMs,
        // Casual matches legitimately report 0 - they never move rating.
        ratingChange: rating ? (rating.changes[p.userId] ?? 0) : null,
      })),
    });
  }

  async finishMatch(params: FinishParams): Promise<boolean> {
    const finished = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, params.matchId);
      return this.finalizeInTx(tx, params);
    });
    if (finished) await this.afterFinish(params.matchId);
    return finished;
  }

  /**
   * The opponent wins. Idempotent for the player who gave up: repeating the
   * request returns the already-recorded result and changes nothing.
   */
  async giveUp(matchId: string, userId: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { participants: true },
      });
      if (!match) throw new MatchNotFoundException();
      const me = match.participants.find((p) => p.userId === userId);
      if (!me) throw new MatchAccessDeniedException();
      if (me.gaveUpAt) return 'REPEATED' as const;

      if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED) {
        throw new MatchAlreadyFinishedException();
      }
      if (match.status !== MatchStatus.IN_PROGRESS) throw new MatchNotActiveException();
      // Past the deadline the result belongs to timeout resolution, which is
      // already due - a forfeit must not pre-empt it.
      if (match.expiresAt && match.expiresAt.getTime() <= Date.now()) {
        throw new MatchExpiredException();
      }
      const opponent = match.participants.find((p) => p.userId !== userId);
      if (!opponent) throw new MatchNotActiveException('This match has no opponent.');

      await tx.matchParticipant.update({
        where: { matchId_userId: { matchId, userId } },
        data: { gaveUpAt: new Date() },
      });
      const finished = await this.finalizeInTx(tx, {
        matchId,
        reason: MatchFinishReason.PLAYER_GAVE_UP,
        decision: win(opponent.userId),
      });
      return finished ? ('FINISHED' as const) : ('REPEATED' as const);
    });

    if (outcome === 'FINISHED') {
      this.socket.emitToMatch(matchId, SocketEvents.PLAYER_GAVE_UP, { matchId, userId });
      await this.afterFinish(matchId);
    }
    return { success: true, match: await this.resultSummary(matchId) };
  }

  /** No-op unless the match is IN_PROGRESS and its expiresAt has passed. */
  async resolveTimeout(matchId: string): Promise<boolean> {
    const finished = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: { status: true, expiresAt: true },
      });
      if (
        !match ||
        match.status !== MatchStatus.IN_PROGRESS ||
        !match.expiresAt ||
        match.expiresAt.getTime() > Date.now()
      ) {
        return false;
      }
      const standings = await loadStandings(tx, matchId);
      return this.finalizeInTx(tx, {
        matchId,
        reason: MatchFinishReason.TIME_EXPIRED,
        decision: decideTimeoutResult(standings.players),
      });
    });
    if (finished) await this.afterFinish(matchId);
    return finished;
  }

  /**
   * System/admin cancellation. CANCELLED matches are never rated -
   * RatingService refuses anything that is not FINISHED.
   */
  async cancelMatch(matchId: string, ratingReason = 'SYSTEM_CANCELLED'): Promise<boolean> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const claim = await tx.match.updateMany({
        where: { id: matchId, status: { in: ACTIVE_MATCH_STATUSES } },
        data: {
          status: MatchStatus.CANCELLED,
          finishReason: MatchFinishReason.SYSTEM_CANCELLED,
          finishedAt: new Date(),
          ratingReason,
        },
      });
      if (claim.count !== 1) return false;
      await this.closeRoom(tx, matchId);
      return true;
    });
    if (cancelled) {
      this.socket.emitToMatch(matchId, SocketEvents.MATCH_CANCELLED, {
        matchId,
        reason: ratingReason,
      });
    }
    return cancelled;
  }

  async resultSummary(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        winnerId: true,
        resultType: true,
        finishReason: true,
        finishedAt: true,
        ratingEligible: true,
      },
    });
    if (!match) throw new MatchNotFoundException();
    return match;
  }

  /**
   * A rating failure must not lose the committed match result. The match stays
   * FINISHED with ratingProcessedAt null and MatchTimeoutService retries it.
   */
  async applyRatingSafely(matchId: string): Promise<RatingResult | null> {
    try {
      return await this.rating.applyMatchRating(matchId);
    } catch (err) {
      this.logger.error(
        `Failed to apply rating for match ${matchId}; will be retried`,
        err instanceof Error ? err.stack : err,
      );
      return null;
    }
  }

  /** A room's single match is over, so the room is too - frees its host. */
  private async closeRoom(tx: Prisma.TransactionClient, matchId: string): Promise<void> {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: { roomId: true },
    });
    if (match?.roomId) {
      await tx.room.update({
        where: { id: match.roomId },
        data: { status: RoomStatus.FINISHED },
      });
    }
  }
}
