import { Injectable, Logger } from '@nestjs/common';
import { MatchStatus, MatchType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { RatingService } from '../rating/rating.service';
import { SocketEvents } from '../../socket/socket.events';

/**
 * Owns everything that happens to a match after it is IN_PROGRESS: closing a
 * round, deciding who won it, advancing to the next one, declaring the match
 * winner, and handing off to RatingService.
 *
 * Match format (product rules, server-decided - never derived from client
 * input):
 *   - Best-of-N rounds. A player who wins a majority of rounds
 *     (floor(totalRounds / 2) + 1) wins the match immediately, so a 2-0 in a
 *     best-of-3 ends without playing round 3.
 *   - A round closes as soon as BOTH players have submitted, or when its
 *     endsAt deadline passes - whichever happens first. The deadline half is
 *     driven by MatchProgressionSweeper.
 *   - Round winner: higher score, tie broken by the earlier submission. A
 *     round where neither player submitted is a draw and counts for nobody.
 *   - If round wins are level after the final round, the match is decided by
 *     total score, then by the earlier last submission.
 *   - A match in which neither player ever submitted anything is CANCELLED,
 *     not finished, so it can never move rating (spec: cancelled/expired
 *     matches are never rated).
 *
 * Concurrency: both "both players submitted" and "the deadline passed" can
 * fire at the same instant, from different processes. Every state transition
 * here is therefore a conditional claim (updateMany filtered on the state it
 * is leaving) and the caller only proceeds when it observes count === 1, so
 * exactly one caller ever closes a given round or finishes a given match.
 */
@Injectable()
export class MatchProgressionService {
  private readonly logger = new Logger(MatchProgressionService.name);

  constructor(
    private prisma: PrismaService,
    private socket: SocketGateway,
    private rating: RatingService,
  ) {}

  /**
   * Quick Match players live in MatchParticipant; private-room players are
   * still read from room.players, unchanged. Mirrors RatingService's split so
   * the two layers can never disagree about who was in a match.
   */
  private participantIds(match: {
    type: MatchType;
    participants: { userId: string }[];
    room: { players: { userId: string }[] } | null;
  }): string[] {
    return match.type === MatchType.QUICK_MATCH
      ? match.participants.map((p) => p.userId)
      : match.room?.players.map((p) => p.userId) ?? [];
  }

  private loadRound(roundId: string) {
    return this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        submissions: true,
        challenge: { select: { id: true, title: true, timeLimitSeconds: true } },
        match: {
          include: { participants: true, room: { include: { players: true } } },
        },
      },
    });
  }

  /**
   * Close the round if it is due, otherwise do nothing. Safe to call from the
   * submit path and from the deadline sweeper concurrently.
   */
  async maybeCloseRound(roundId: string): Promise<void> {
    const round = await this.loadRound(roundId);
    if (!round) return;
    if (round.finishedAt) return;
    if (round.match.status !== MatchStatus.IN_PROGRESS) return;

    const players = this.participantIds(round.match);
    const everyoneSubmitted =
      players.length > 0 &&
      players.every((userId) =>
        round.submissions.some((s) => s.userId === userId),
      );
    const deadlinePassed = !!round.endsAt && round.endsAt.getTime() <= Date.now();
    if (!everyoneSubmitted && !deadlinePassed) return;

    await this.closeRound(roundId);
  }

  /**
   * Decide the round, claim it, and advance the match. The claim is what makes
   * this idempotent - a second caller sees count === 0 and returns.
   */
  private async closeRound(roundId: string): Promise<void> {
    const round = await this.loadRound(roundId);
    if (!round || round.finishedAt) return;

    const players = this.participantIds(round.match);
    const winnerId = this.decideRoundWinner(round.submissions, players);

    const claim = await this.prisma.round.updateMany({
      where: { id: roundId, finishedAt: null },
      data: { finishedAt: new Date(), winnerId },
    });
    if (claim.count === 0) return; // another caller closed it first

    const results = players.map((userId) => {
      const submission = round.submissions.find((s) => s.userId === userId);
      return {
        userId,
        submitted: !!submission,
        score: submission?.score ?? 0,
        passedTests: submission?.passedTests ?? 0,
        totalTests: submission?.totalTests ?? 0,
        runtimeMs: submission?.runtimeMs ?? 0,
      };
    });

    // The round is over, so opponent scores and code are no longer secret.
    for (const userId of players) {
      this.socket.emitToUser(userId, SocketEvents.ROUND_END, {
        matchId: round.matchId,
        roundId: round.id,
        roundNumber: round.roundNumber,
        winnerId,
        results,
      });
    }

    await this.advanceAfterRound(round.matchId, round.roundNumber);
  }

  /**
   * Higher score wins; a tie goes to whoever submitted first. Missing
   * submissions count as a loss, and two missing submissions are a draw.
   */
  private decideRoundWinner(
    submissions: { userId: string; score: number; submittedAt: Date }[],
    players: string[],
  ): string | null {
    const entries = players
      .map((userId) => submissions.find((s) => s.userId === userId))
      .filter((s): s is NonNullable<typeof s> => !!s);

    if (entries.length === 0) return null;
    if (entries.length === 1) return entries[0].userId;

    const [a, b] = entries;
    if (a.score !== b.score) return a.score > b.score ? a.userId : b.userId;

    const at = a.submittedAt.getTime();
    const bt = b.submittedAt.getTime();
    if (at !== bt) return at < bt ? a.userId : b.userId;

    return null; // genuine draw
  }

  /** Either declare a match winner, or schedule the next round. */
  private async advanceAfterRound(
    matchId: string,
    closedRoundNumber: number,
  ): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        room: { include: { players: true } },
        rounds: { include: { submissions: true } },
      },
    });
    if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

    const players = this.participantIds(match);
    const closedRounds = match.rounds.filter((r) => r.finishedAt);
    const winsNeeded = Math.floor(match.totalRounds / 2) + 1;

    const decisive = players.find(
      (userId) =>
        closedRounds.filter((r) => r.winnerId === userId).length >= winsNeeded,
    );
    if (decisive) {
      await this.finishMatch(matchId, decisive);
      return;
    }

    if (closedRoundNumber < match.totalRounds) {
      await this.startNextRound(matchId, closedRoundNumber + 1);
      return;
    }

    // Final round is closed and nobody reached the majority - fall back to the
    // aggregate tiebreakers.
    const totals = players.map((userId) => {
      const subs = match.rounds
        .flatMap((r) => r.submissions)
        .filter((s) => s.userId === userId);
      return {
        userId,
        roundWins: closedRounds.filter((r) => r.winnerId === userId).length,
        totalScore: subs.reduce((sum, s) => sum + s.score, 0),
        lastSubmittedAt: subs.length
          ? Math.max(...subs.map((s) => s.submittedAt.getTime()))
          : Number.POSITIVE_INFINITY,
        submissionCount: subs.length,
      };
    });

    if (totals.every((t) => t.submissionCount === 0)) {
      // Nobody ever played. Cancelling (rather than finishing with an
      // arbitrary winner) keeps this out of the rating system entirely.
      await this.cancelUnplayedMatch(matchId);
      return;
    }

    const ranked = [...totals].sort(
      (x, y) =>
        y.roundWins - x.roundWins ||
        y.totalScore - x.totalScore ||
        x.lastSubmittedAt - y.lastSubmittedAt,
    );
    const [first, second] = ranked;
    const tied =
      second &&
      first.roundWins === second.roundWins &&
      first.totalScore === second.totalScore &&
      first.lastSubmittedAt === second.lastSubmittedAt;

    if (tied) {
      // Every tiebreaker exhausted - no winner can be named, so this match
      // must not be rated either.
      await this.cancelUnplayedMatch(matchId, 'MATCH_DRAWN_NO_RATING');
      return;
    }

    await this.finishMatch(matchId, first.userId);
  }

  private async cancelUnplayedMatch(
    matchId: string,
    reason = 'NO_SUBMISSIONS_NO_RATING',
  ): Promise<void> {
    const claim = await this.prisma.match.updateMany({
      where: { id: matchId, status: MatchStatus.IN_PROGRESS },
      data: {
        status: MatchStatus.CANCELLED,
        finishedAt: new Date(),
        ratingReason: reason,
      },
    });
    if (claim.count === 0) return;

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true, room: { include: { players: true } } },
    });
    if (!match) return;

    for (const userId of this.participantIds(match)) {
      this.socket.emitToUser(userId, SocketEvents.MATCH_END, {
        matchId,
        status: MatchStatus.CANCELLED,
        winnerId: null,
        reason,
      });
    }
  }

  private async startNextRound(
    matchId: string,
    roundNumber: number,
  ): Promise<void> {
    const round = await this.prisma.round.findFirst({
      where: { matchId, roundNumber },
      include: { challenge: true },
    });
    if (!round) return;

    const now = new Date();
    const endsAt = new Date(
      now.getTime() + (round.challenge.timeLimitSeconds || 300) * 1000,
    );

    // Conditional on startedAt still being null so two concurrent advances
    // cannot restart (and re-extend) a round that is already running.
    const claim = await this.prisma.round.updateMany({
      where: { id: round.id, startedAt: null, finishedAt: null },
      data: { startedAt: now, endsAt },
    });
    if (claim.count === 0) return;

    await this.prisma.match.update({
      where: { id: matchId },
      data: { currentRoundNumber: roundNumber },
    });

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true, room: { include: { players: true } } },
    });
    if (!match) return;

    for (const userId of this.participantIds(match)) {
      this.socket.emitToUser(userId, SocketEvents.ROUND_START, {
        matchId,
        round: {
          id: round.id,
          roundNumber: round.roundNumber,
          challengeId: round.challengeId,
          startedAt: now,
          endsAt,
        },
      });
    }
  }

  /**
   * Claim the match as FINISHED with a server-decided winner, then apply
   * rating. Rating has to be a second step because RatingService deliberately
   * refuses to touch a match that is not already FINISHED - it re-reads the
   * persisted result rather than trusting anything passed to it. Its own
   * transaction is what makes the stats/Elo/history/leaderboard update atomic,
   * and its ratingProcessedAt guard makes this safe to retry, which is what
   * MatchProgressionSweeper.retryUnratedMatches relies on if this process dies
   * between the two steps.
   */
  async finishMatch(matchId: string, winnerId: string): Promise<void> {
    const claim = await this.prisma.match.updateMany({
      where: { id: matchId, status: MatchStatus.IN_PROGRESS },
      data: { status: MatchStatus.FINISHED, winnerId, finishedAt: new Date() },
    });
    if (claim.count === 0) return;

    const rating = await this.applyRatingSafely(matchId);

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        room: { include: { players: true } },
        rounds: { select: { roundNumber: true, winnerId: true } },
      },
    });
    if (!match) return;

    for (const userId of this.participantIds(match)) {
      this.socket.emitToUser(userId, SocketEvents.MATCH_END, {
        matchId,
        status: MatchStatus.FINISHED,
        winnerId,
        won: userId === winnerId,
        ratingEligible: match.ratingEligible,
        // Casual matches legitimately report 0 here - private rooms never
        // move rating (see RatingService.applyCasualResult).
        ratingChange: rating
          ? userId === winnerId
            ? rating.winnerChange
            : rating.loserChange
          : null,
        rounds: match.rounds
          .slice()
          .sort((a, b) => a.roundNumber - b.roundNumber),
      });
    }
  }

  /**
   * A rating failure must not lose the match result that is already committed.
   * The match stays FINISHED with ratingProcessedAt null, which the sweeper
   * picks up and retries.
   */
  async applyRatingSafely(matchId: string) {
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
}
