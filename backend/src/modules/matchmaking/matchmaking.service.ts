import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MatchStatus, MatchType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { SocketEvents } from '../../socket/socket.events';
import { RoomsService } from '../rooms/rooms.service';
import {
  ActiveMatchExistsException,
  ActiveRoomExistsException,
  ChallengePoolInsufficientException,
  InvalidMatchStateException,
  MatchAlreadyFoundException,
  MatchmakingUnavailableException,
  MatchNotFoundException,
  UserStatsNotFoundException,
} from '../../common/exceptions/app.exception';
import { MatchmakingConfig, loadMatchmakingConfig } from './matchmaking.constants';
import { getRatingTolerance, pickRandom } from './matchmaking.util';
import {
  claimPair,
  dequeue,
  enqueue,
  findCandidatesInRange,
  getAllWaiting,
  getOldestWaiting,
  getQueueEntry,
  getReservationPartner,
  isRecentPair,
  isStale,
  markRecentPair,
  requeueAll,
  touchLastSeen,
  clearReservations,
} from './matchmaking.redis';
import {
  MatchedState,
  MatchFoundPayload,
  MatchmakingState,
  MatchmakingStatus,
  OpponentSummary,
  QueueEntry,
} from './matchmaking.types';

const ACTIVE_QUICK_MATCH_STATUSES: MatchStatus[] = [
  MatchStatus.PENDING_READY,
  MatchStatus.READY,
  MatchStatus.IN_PROGRESS,
];

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  readonly config: MatchmakingConfig;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private rooms: RoomsService,
    private socket: SocketGateway,
    config: ConfigService,
  ) {
    this.config = loadMatchmakingConfig(config);
  }

  private client() {
    return this.redis.getClient();
  }

  private emitToUser(userId: string, event: string, payload: unknown) {
    this.socket.server.to(`user:${userId}`).emit(event, payload);
  }

  private async findActiveQuickMatch(userId: string) {
    return this.prisma.matchParticipant.findFirst({
      where: {
        userId,
        match: { type: MatchType.QUICK_MATCH, status: { in: ACTIVE_QUICK_MATCH_STATUSES } },
      },
      include: { match: true },
    });
  }

  // --- Public API -----------------------------------------------------

  async startSearch(userId: string): Promise<MatchmakingState> {
    let existing: QueueEntry | null;
    try {
      existing = await getQueueEntry(this.client(), userId);
    } catch (err) {
      throw this.toUnavailable(err);
    }
    if (existing) {
      // Idempotent: repeated POSTs while searching return current state
      // rather than creating a second queue entry (spec section 8).
      return this.searchingState(existing);
    }

    const activeMatch = await this.findActiveQuickMatch(userId);
    if (activeMatch) throw new ActiveMatchExistsException();

    const activeRoom = await this.rooms.findActiveRoomForUser(userId);
    if (activeRoom) throw new ActiveRoomExistsException();

    const stats = await this.prisma.userStats.findUnique({ where: { userId } });
    if (!stats) throw new UserStatsNotFoundException();

    const entry: QueueEntry = { userId, rating: stats.rating, joinedAt: Date.now() };
    try {
      await enqueue(this.client(), userId, entry.rating, entry.joinedAt, this.config.staleTimeoutMs);
    } catch (err) {
      throw this.toUnavailable(err);
    }
    this.logger.log(`User ${userId} entered Quick Match queue at rating ${entry.rating}`);

    // Try to pair immediately so two players queueing around the same time
    // don't have to wait for the next worker tick.
    const matched = await this.attemptMatch(userId).catch((err) => {
      this.logger.error('attemptMatch failed during startSearch', err instanceof Error ? err.stack : err);
      return null;
    });
    if (matched) return matched;

    return this.searchingState(entry);
  }

  async cancelSearch(userId: string): Promise<MatchmakingState> {
    const activeMatch = await this.findActiveQuickMatch(userId);
    if (activeMatch) throw new MatchAlreadyFoundException(activeMatch.matchId);

    try {
      const reservedWith = await getReservationPartner(this.client(), userId);
      if (reservedWith) {
        // Claimed but the Postgres Match hasn't committed yet (sub-second
        // window) - don't destroy it, the caller should poll GET shortly.
        throw new MatchAlreadyFoundException(null);
      }
      await dequeue(this.client(), userId);
    } catch (err) {
      if (err instanceof MatchAlreadyFoundException) throw err;
      throw this.toUnavailable(err);
    }
    return { status: MatchmakingStatus.IDLE };
  }

  async getStatus(userId: string): Promise<MatchmakingState> {
    const activeMatch = await this.findActiveQuickMatch(userId);
    if (activeMatch) return { status: MatchmakingStatus.MATCHED, matchId: activeMatch.matchId };

    let entry: QueueEntry | null;
    try {
      entry = await getQueueEntry(this.client(), userId);
      if (entry) await touchLastSeen(this.client(), userId, this.config.staleTimeoutMs);
    } catch (err) {
      throw this.toUnavailable(err);
    }
    if (entry) return this.searchingState(entry);
    return { status: MatchmakingStatus.IDLE };
  }

  /** Called by SocketGateway on reconnect to keep a queued user's entry fresh. */
  async heartbeat(userId: string): Promise<void> {
    try {
      const entry = await getQueueEntry(this.client(), userId);
      if (entry) await touchLastSeen(this.client(), userId, this.config.staleTimeoutMs);
    } catch (err) {
      this.logger.warn(`Matchmaking heartbeat failed for ${userId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async handleReady(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true },
    });
    if (!match) throw new MatchNotFoundException();
    if (match.type !== MatchType.QUICK_MATCH) {
      throw new InvalidMatchStateException('This match does not use ready confirmation.');
    }
    if (match.status !== MatchStatus.PENDING_READY && match.status !== MatchStatus.READY) {
      throw new InvalidMatchStateException();
    }
    const participant = match.participants.find((p) => p.userId === userId);
    if (!participant) throw new ForbiddenException('You are not a participant in this match.');

    if (!participant.readyAt) {
      await this.prisma.matchParticipant.update({
        where: { matchId_userId: { matchId, userId } },
        data: { readyAt: new Date() },
      });
    }

    // Re-read fresh from the DB (not the snapshot above) so a concurrent
    // ready call from the other participant, landing at nearly the same
    // time, is correctly observed here instead of racing on stale data.
    const freshParticipants = await this.prisma.matchParticipant.findMany({ where: { matchId } });
    const allReady = freshParticipants.every((p) => p.readyAt);
    if (!allReady) {
      return { matchId, status: match.status };
    }

    // Both ready - but two concurrent requests could both observe allReady.
    // Only the one that actually flips PENDING_READY -> READY proceeds to
    // start the match; the loser just reports the state the winner will
    // shortly produce. Same optimistic-update pattern as the ready-timeout
    // sweep, just scoped to a single row instead of a batch.
    const claim = await this.prisma.match.updateMany({
      where: { id: matchId, status: MatchStatus.PENDING_READY },
      data: { status: MatchStatus.READY },
    });
    if (claim.count !== 1) {
      return { matchId, status: MatchStatus.READY };
    }

    return this.startQuickMatch(
      matchId,
      freshParticipants.map((p) => p.userId),
      match.totalRounds,
    );
  }

  // --- Background worker entry points ---------------------------------

  async processPairingBatch(): Promise<void> {
    const client = this.client();
    const oldest = await getOldestWaiting(client, this.config.maxPerTick);
    for (const userId of oldest) {
      await this.attemptMatch(userId).catch((err) => {
        this.logger.error(`attemptMatch failed for ${userId}`, err instanceof Error ? err.stack : err);
      });
    }
  }

  async sweepStaleQueueEntries(): Promise<void> {
    const client = this.client();
    const waiting = await getAllWaiting(client);
    for (const userId of waiting) {
      if (await isStale(client, userId)) {
        await dequeue(client, userId);
        this.logger.log(`Removed stale Quick Match queue entry for user ${userId}`);
      }
    }
  }

  async processReadyTimeouts(): Promise<void> {
    const expired = await this.prisma.match.findMany({
      where: {
        type: MatchType.QUICK_MATCH,
        status: { in: [MatchStatus.PENDING_READY, MatchStatus.READY] },
        readyDeadline: { lt: new Date() },
      },
      include: { participants: true },
    });

    for (const match of expired) {
      // Optimistic, DB-native claim: only the instance/tick whose update
      // actually flips the row wins - safe with multiple backend instances
      // all running this same sweep, without any in-process timer.
      const claim = await this.prisma.match.updateMany({
        where: { id: match.id, status: match.status },
        data: { status: MatchStatus.CANCELLED, finishedAt: new Date() },
      });
      if (claim.count !== 1) continue;

      const ready = match.participants.filter((p) => p.readyAt);
      const notReady = match.participants.filter((p) => !p.readyAt);
      this.logger.log(`Quick Match ${match.id} cancelled: ready timeout (${ready.length}/${match.participants.length} ready)`);

      if (ready.length > 0 && notReady.length > 0) {
        for (const p of ready) {
          this.emitToUser(p.userId, SocketEvents.MATCHMAKING_OPPONENT_UNAVAILABLE, { matchId: match.id });
        }
        // Documented choice (spec section 35): automatically requeue whoever
        // was ready, rather than dropping them back to IDLE.
        for (const p of ready) {
          await this.requeueAfterTimeout(p.userId, p.ratingBefore);
        }
      } else {
        for (const p of match.participants) {
          this.emitToUser(p.userId, SocketEvents.MATCHMAKING_CANCELLED, { matchId: match.id });
        }
      }
    }
  }

  // --- Internals --------------------------------------------------------

  private async requeueAfterTimeout(userId: string, rating: number): Promise<void> {
    const entry: QueueEntry = { userId, rating, joinedAt: Date.now() };
    try {
      await enqueue(this.client(), userId, entry.rating, entry.joinedAt, this.config.staleTimeoutMs);
      this.emitToUser(userId, SocketEvents.MATCHMAKING_SEARCHING, this.searchingState(entry));
      const matched = await this.attemptMatch(userId);
      if (matched) return;
    } catch (err) {
      this.logger.error(`Failed to auto-requeue ${userId} after ready timeout`, err instanceof Error ? err.stack : err);
    }
  }

  /** Attempts to pair `userId` with the best available candidate. Returns the
   * MATCHED state if successful, or null if no match was made this attempt
   * (still safely in the queue either way). */
  async attemptMatch(userId: string): Promise<MatchedState | null> {
    const client = this.client();
    const self = await getQueueEntry(client, userId);
    if (!self) return null; // no longer searching (cancelled, already matched, etc.)

    const waitSeconds = (Date.now() - self.joinedAt) / 1000;
    const tolerance = getRatingTolerance(waitSeconds, this.config);
    const candidates = await findCandidatesInRange(
      client,
      userId,
      self.rating - tolerance,
      self.rating + tolerance,
    );
    if (candidates.length === 0) return null;

    const ranked = candidates
      .filter((c) => c.userId !== userId) // never match a user with themself, even under malformed state
      .sort((a, b) => {
        const diff = Math.abs(a.rating - self.rating) - Math.abs(b.rating - self.rating);
        if (diff !== 0) return diff;
        return a.joinedAt - b.joinedAt; // longest-waiting breaks ties
      });

    const ordered = await this.preferNonRecentOpponents(userId, ranked);

    for (const candidate of ordered) {
      const claimed = await claimPair(client, userId, candidate.userId, this.config.reservationTtlSeconds);
      if (!claimed) continue; // another instance/tick claimed one of them first - try the next candidate
      const result = await this.createMatchFromPair(self, candidate);
      if (result) return result;
      // createMatchFromPair already requeued both on failure - stop this attempt.
      return null;
    }
    return null;
  }

  /** Soft repeat-opponent avoidance: within the top few candidates, prefer
   * one this user hasn't played very recently, when an alternative exists. */
  private async preferNonRecentOpponents(userId: string, ranked: QueueEntry[]): Promise<QueueEntry[]> {
    const client = this.client();
    const topN = ranked.slice(0, 5);
    const rest = ranked.slice(5);
    const flags = await Promise.all(topN.map((c) => isRecentPair(client, userId, c.userId)));
    const fresh = topN.filter((_, i) => !flags[i]);
    const recent = topN.filter((_, i) => flags[i]);
    return [...fresh, ...recent, ...rest];
  }

  private async createMatchFromPair(a: QueueEntry, b: QueueEntry): Promise<MatchedState | null> {
    try {
      const match = await this.prisma.$transaction(async (tx) => {
        const created = await tx.match.create({
          data: {
            type: MatchType.QUICK_MATCH,
            status: MatchStatus.PENDING_READY,
            ratingEligible: true,
            totalRounds: 3,
            readyDeadline: new Date(Date.now() + this.config.readyTimeoutSeconds * 1000),
          },
        });
        await tx.matchParticipant.createMany({
          data: [
            { matchId: created.id, userId: a.userId, ratingBefore: a.rating },
            { matchId: created.id, userId: b.userId, ratingBefore: b.rating },
          ],
        });
        return created;
      });

      await clearReservations(this.client(), [a.userId, b.userId]);
      await markRecentPair(this.client(), a.userId, b.userId, this.config.recentOpponentTtlSeconds);
      this.logger.log(`Quick Match ${match.id} created: ${a.userId} (${a.rating}) vs ${b.userId} (${b.rating})`);

      await this.notifyMatchFound(match.id, a, b, match.readyDeadline!);
      return { status: MatchmakingStatus.MATCHED, matchId: match.id };
    } catch (err) {
      this.logger.error(
        `Match creation failed for pair ${a.userId}/${b.userId} - requeuing both`,
        err instanceof Error ? err.stack : err,
      );
      await requeueAll(this.client(), [a, b], this.config.staleTimeoutMs).catch((requeueErr) => {
        this.logger.error('Failed to requeue after match-creation failure', requeueErr instanceof Error ? requeueErr.stack : requeueErr);
      });
      await clearReservations(this.client(), [a.userId, b.userId]).catch(() => undefined);
      return null;
    }
  }

  private async notifyMatchFound(matchId: string, a: QueueEntry, b: QueueEntry, readyDeadline: Date) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [a.userId, b.userId] } },
      select: {
        id: true,
        username: true,
        profile: { select: { displayName: true, avatarUrl: true } },
      },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const summaryFor = (id: string, rating: number): OpponentSummary => {
      const u = byId.get(id);
      return {
        id,
        username: u?.username ?? 'unknown',
        displayName: u?.profile?.displayName ?? null,
        avatarUrl: u?.profile?.avatarUrl ?? null,
        rating,
      };
    };

    const payloadFor = (selfEntry: QueueEntry, opponentEntry: QueueEntry): MatchFoundPayload => ({
      matchId,
      status: 'PENDING_READY',
      opponent: summaryFor(opponentEntry.userId, opponentEntry.rating),
      readyDeadline: readyDeadline.toISOString(),
    });

    this.emitToUser(a.userId, SocketEvents.MATCHMAKING_MATCH_FOUND, payloadFor(a, b));
    this.emitToUser(b.userId, SocketEvents.MATCHMAKING_MATCH_FOUND, payloadFor(b, a));
  }

  /** Called once handleReady's atomic claim has already flipped the match to
   * READY - this always runs exactly once per match (the claim guarantees
   * only one caller ever reaches here). */
  private async startQuickMatch(matchId: string, participantUserIds: string[], totalRounds: number) {
    const pool = await this.prisma.challenge.findMany({ where: { isPublished: true } });
    if (pool.length < totalRounds) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.CANCELLED, finishedAt: new Date() },
      });
      throw new ChallengePoolInsufficientException();
    }

    const picks = pickRandom(pool, totalRounds);
    const now = new Date();
    const rounds: { id: string; roundNumber: number }[] = [];
    let roundNumber = 1;
    for (const challenge of picks) {
      // Only round 1 is scheduled here. Rounds 2+ are created unscheduled and
      // get their startedAt/endsAt from MatchProgressionService.startNextRound
      // when the previous round closes - otherwise their deadline would be
      // measured from match start and they would already be expired by the
      // time players ever saw them.
      const isFirst = roundNumber === 1;
      const startedAt = isFirst ? now : null;
      const endsAt = isFirst
        ? new Date(now.getTime() + (challenge.timeLimitSeconds || 300) * 1000)
        : null;
      const round = await this.prisma.round.create({
        data: { matchId, challengeId: challenge.id, roundNumber, startedAt, endsAt },
      });
      rounds.push(round);
      roundNumber++;
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.IN_PROGRESS, currentRoundNumber: 1, startedAt: now },
    });

    for (const userId of participantUserIds) {
      this.emitToUser(userId, SocketEvents.MATCH_START, { matchId });
      this.emitToUser(userId, SocketEvents.ROUND_START, { round: rounds[0] });
    }

    return { matchId, status: MatchStatus.IN_PROGRESS };
  }

  private searchingState(entry: QueueEntry): MatchmakingState {
    const waitSeconds = (Date.now() - entry.joinedAt) / 1000;
    const tolerance = getRatingTolerance(waitSeconds, this.config);
    return {
      status: MatchmakingStatus.SEARCHING,
      joinedAt: new Date(entry.joinedAt).toISOString(),
      rating: entry.rating,
      ratingRange: { min: entry.rating - tolerance, max: entry.rating + tolerance },
    };
  }

  private toUnavailable(err: unknown): Error {
    this.logger.error('Matchmaking Redis operation failed', err instanceof Error ? err.stack : err);
    return new MatchmakingUnavailableException();
  }
}
