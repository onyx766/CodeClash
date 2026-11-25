import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  MatchChallengeProgress,
  MatchChallengeStatus,
  MatchFinishReason,
  MatchResultType,
  MatchStatus,
  MatchType,
  Prisma,
  Role,
  RoomStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { SocketEvents } from '../../socket/socket.events';
import { roleAtLeast } from '../../common/constants/role-hierarchy';
import {
  ActiveMatchExistsException,
  InsufficientBattleChallengesException,
  MatchAccessDeniedException,
  MatchNotActiveException,
  MatchNotFoundException,
  RoomAccessDeniedException,
  RoomExpiredException,
  RoomHostRequiredException,
  RoomNotFoundException,
  RoomNotReadyException,
} from '../../common/exceptions/app.exception';
import { BattleConfig, loadBattleConfig } from './battle.config';
import { MatchSelectionService, SelectableChallenge } from './match-selection.service';
import { ACTIVE_MATCH_STATUSES } from './match-finalization.service';
import { loadStandings } from './match-standings';

/** UserStats.rating's schema default, for a player whose stats row is missing. */
const DEFAULT_RATING = 1200;

export interface MatchViewer {
  id: string;
  role: Role;
}

const MATCH_VIEW_INCLUDE = Prisma.validator<Prisma.MatchInclude>()({
  room: { select: { code: true } },
  participants: {
    orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
    include: {
      user: {
        select: {
          id: true,
          username: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
  },
  challenges: {
    orderBy: { position: 'asc' },
    include: {
      challenge: { select: { id: true, slug: true, title: true, difficulty: true } },
      progress: true,
    },
  },
});

type MatchForView = Prisma.MatchGetPayload<{ include: typeof MATCH_VIEW_INCLUDE }>;
type ParticipantForView = MatchForView['participants'][number];

export interface MatchLogEntry {
  at: Date;
  /** Milliseconds since the match started - what the Match Log displays. */
  offsetMs: number;
  type: 'MATCH_STARTED' | 'CHALLENGE_SOLVED' | 'PLAYER_GAVE_UP' | 'MATCH_FINISHED' | 'MATCH_CANCELLED';
  userId?: string;
  matchChallengeId?: string;
  challengeTitle?: string;
  winnerId?: string | null;
  resultType?: string | null;
  finishReason?: MatchFinishReason | null;
}

/**
 * Battle lifecycle: starting a match (both private rooms and Quick Match go
 * through createBattle) and the player-facing read models.
 *
 * A match is five (MATCH_CHALLENGE_COUNT) challenges selected once, stored as
 * MatchChallenge rows, and shared by both players, who solve them in any
 * order. Ending a match lives in MatchFinalizationService; turning runner
 * verdicts into progress lives in RunnerResultService.
 */
@Injectable()
export class MatchesService {
  private readonly battle: BattleConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly selection: MatchSelectionService,
    private readonly socket: SocketGateway,
    config: ConfigService,
  ) {
    this.battle = loadBattleConfig(config);
  }

  // -------------------------------------------------------------------------
  // starting
  // -------------------------------------------------------------------------

  /**
   * POST /rooms/:code/start. Host only, exactly two players, room still open.
   *
   * Idempotent: the room row is locked while the match is created and
   * Match.roomId is unique, so a double click (or two tabs) yields one match;
   * the second call gets the existing match back with alreadyStarted: true.
   * Always PRIVATE_ROOM / not rating eligible - never derived from input.
   */
  async startPrivateRoomMatch(code: string, requesterId: string) {
    const room = await this.prisma.room.findUnique({
      where: { code },
      include: {
        players: { orderBy: { joinedAt: 'asc' } },
        match: { select: { id: true } },
      },
    });
    if (!room) throw new RoomNotFoundException();
    if (!room.players.some((p) => p.userId === requesterId)) {
      throw new RoomAccessDeniedException();
    }
    if (room.hostId !== requesterId) throw new RoomHostRequiredException();
    if (room.match) {
      return { success: true, alreadyStarted: true, match: await this.startSummary(room.match.id) };
    }
    this.assertRoomStartable(room);

    const userIds = room.players.map((p) => p.userId);
    await this.assertNoOtherActiveMatch(userIds);
    // Selected before anything is written: an insufficient pool leaves the
    // room exactly as it was.
    const picks = await this.selection.selectChallenges();
    const ratings = await this.currentRatings(userIds);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${room.id} FOR UPDATE`;
      const fresh = await tx.room.findUnique({
        where: { id: room.id },
        include: { players: true, match: { select: { id: true } } },
      });
      if (!fresh) throw new RoomNotFoundException();
      if (fresh.match) return { matchId: fresh.match.id, created: false };
      this.assertRoomStartable(fresh);
      const freshIds = fresh.players.map((p) => p.userId).sort();
      if (freshIds.join() !== [...userIds].sort().join()) {
        throw new RoomNotReadyException('The room changed while starting. Try again.');
      }

      const now = new Date();
      const match = await tx.match.create({
        data: {
          roomId: room.id,
          type: MatchType.PRIVATE_ROOM,
          status: MatchStatus.IN_PROGRESS,
          ratingEligible: false,
          ratingReason: 'PRIVATE_ROOM_CASUAL',
          startedAt: now,
          expiresAt: new Date(now.getTime() + this.battle.durationMs),
        },
        select: { id: true },
      });
      await tx.matchParticipant.createMany({
        data: userIds.map((userId) => ({
          matchId: match.id,
          userId,
          ratingBefore: ratings.get(userId) ?? DEFAULT_RATING,
          joinedAt: now,
        })),
      });
      await this.createBattle(tx, match.id, picks, userIds);
      await tx.room.update({ where: { id: room.id }, data: { status: RoomStatus.IN_MATCH } });
      return { matchId: match.id, created: true };
    });

    if (result.created) this.announceStart(result.matchId, userIds);
    return {
      success: true,
      alreadyStarted: !result.created,
      match: await this.startSummary(result.matchId),
    };
  }

  /**
   * Called by MatchmakingService once both Quick Match players are ready and
   * its claim has moved the match to READY. Same battle engine as private
   * rooms; the match keeps its QUICK_MATCH / ratingEligible values from
   * matchmaking.
   */
  async startQuickMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true },
    });
    if (!match || match.type !== MatchType.QUICK_MATCH) throw new MatchNotFoundException();
    if (match.status === MatchStatus.IN_PROGRESS) return this.startSummary(matchId);
    if (match.status !== MatchStatus.READY) {
      throw new MatchNotActiveException('This match is not ready to start.');
    }
    const userIds = match.participants.map((p) => p.userId);

    let picks: SelectableChallenge[];
    try {
      picks = await this.selection.selectChallenges();
    } catch (err) {
      if (err instanceof InsufficientBattleChallengesException) {
        // Never start a broken match - cancel it (unrated) instead.
        await this.prisma.match.updateMany({
          where: { id: matchId, status: MatchStatus.READY },
          data: {
            status: MatchStatus.CANCELLED,
            finishReason: MatchFinishReason.SYSTEM_CANCELLED,
            finishedAt: new Date(),
            ratingReason: 'INSUFFICIENT_BATTLE_CHALLENGES',
          },
        });
        for (const userId of userIds) {
          this.socket.emitToUser(userId, SocketEvents.MATCHMAKING_CANCELLED, { matchId });
        }
      }
      throw err;
    }

    const started = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${matchId} FOR UPDATE`;
      const fresh = await tx.match.findUnique({ where: { id: matchId }, select: { status: true } });
      if (fresh?.status !== MatchStatus.READY) return false;
      await this.createBattle(tx, matchId, picks, userIds);
      const now = new Date();
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.IN_PROGRESS,
          startedAt: now,
          expiresAt: new Date(now.getTime() + this.battle.durationMs),
        },
      });
      return true;
    });

    if (started) this.announceStart(matchId, userIds);
    return this.startSummary(matchId);
  }

  /**
   * The challenge set, in position order, plus one progress row per player per
   * challenge (eager, so every later update is a plain conditional update).
   */
  private async createBattle(
    tx: Prisma.TransactionClient,
    matchId: string,
    picks: SelectableChallenge[],
    userIds: string[],
  ) {
    const distinct = new Set(picks.map((c) => c.id));
    if (picks.length !== this.selection.challengeCount || distinct.size !== picks.length) {
      throw new InsufficientBattleChallengesException();
    }
    const rows = picks.map((challenge, index) => ({
      id: randomUUID(),
      matchId,
      challengeId: challenge.id,
      position: index + 1,
    }));
    await tx.matchChallenge.createMany({ data: rows });
    await tx.matchChallengeProgress.createMany({
      data: rows.flatMap((mc) =>
        userIds.map((userId) => ({ matchChallengeId: mc.id, userId })),
      ),
    });
  }

  private announceStart(matchId: string, userIds: string[]) {
    for (const userId of userIds) {
      this.socket.emitToUser(userId, SocketEvents.MATCH_STARTED, { matchId });
    }
  }

  private assertRoomStartable(room: {
    status: RoomStatus;
    expiresAt: Date | null;
    players: unknown[];
  }) {
    if (room.status !== RoomStatus.WAITING && room.status !== RoomStatus.READY) {
      throw new RoomNotReadyException('This room can no longer start a match.');
    }
    if (room.expiresAt && room.expiresAt.getTime() < Date.now()) {
      throw new RoomExpiredException();
    }
    if (room.players.length !== 2) {
      throw new RoomNotReadyException('A match needs exactly 2 players in the room.');
    }
  }

  private async assertNoOtherActiveMatch(userIds: string[]) {
    const busy = await this.prisma.matchParticipant.findFirst({
      where: { userId: { in: userIds }, match: { status: { in: ACTIVE_MATCH_STATUSES } } },
      select: { id: true },
    });
    if (busy) throw new ActiveMatchExistsException();
  }

  /** Server-side rating snapshot - never a client-supplied value. */
  private async currentRatings(userIds: string[]) {
    const stats = await this.prisma.userStats.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, rating: true },
    });
    return new Map(stats.map((s) => [s.userId, s.rating]));
  }

  private async startSummary(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        type: true,
        status: true,
        ratingEligible: true,
        startedAt: true,
        expiresAt: true,
      },
    });
    if (!match) throw new MatchNotFoundException();
    return match;
  }

  // -------------------------------------------------------------------------
  // reading
  // -------------------------------------------------------------------------

  /**
   * GET /matches/:matchId - everything the battle page needs to render or
   * recover after a refresh. Participants see it from their own side; ADMIN
   * and above may view any match as a spectator.
   *
   * Exposes challenge titles/difficulties, both players' statuses and solve
   * times, the viewer's own attempts and, while a Quick Match waits on its
   * ready check, the deadline and who has accepted. Never source code, test
   * data, reference solutions, checkers or generators.
   */
  async getMatch(matchId: string, viewer: MatchViewer) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: MATCH_VIEW_INCLUDE,
    });
    if (!match) throw new MatchNotFoundException();
    const isParticipant = match.participants.some((p) => p.userId === viewer.id);
    if (!isParticipant && !roleAtLeast(viewer.role, Role.ADMIN)) {
      throw new MatchAccessDeniedException();
    }

    const [mine, theirs] = isParticipant
      ? [
          match.participants.find((p) => p.userId === viewer.id),
          match.participants.find((p) => p.userId !== viewer.id),
        ]
      : match.participants;
    const total = match.challenges.length;
    const progressOf = (mc: MatchForView['challenges'][number], userId?: string) =>
      userId ? mc.progress.find((p) => p.userId === userId) : undefined;

    const player = (p?: ParticipantForView) => {
      if (!p) return null;
      const solved = match.challenges
        .map((mc) => progressOf(mc, p.userId))
        .filter((row): row is MatchChallengeProgress => row?.status === MatchChallengeStatus.SOLVED);
      return {
        id: p.userId,
        username: p.user.username,
        displayName: p.user.profile?.displayName ?? null,
        avatarUrl: p.user.profile?.avatarUrl ?? null,
        rating: p.ratingBefore,
        ratingAfter: p.ratingAfter,
        solved: solved.length,
        total,
        totalSolveDurationMs: solved.reduce((sum, row) => sum + (row.solveDurationMs ?? 0), 0),
        gaveUp: !!p.gaveUpAt,
        // Quick Match ready check: this player has accepted.
        ready: !!p.readyAt,
      };
    };
    // Only while the ready check is what the match is waiting on - a later
    // refresh must not show a deadline for a match that started or ended.
    const awaitingReady =
      match.type === MatchType.QUICK_MATCH &&
      (match.status === MatchStatus.PENDING_READY || match.status === MatchStatus.READY);

    return {
      success: true,
      match: {
        id: match.id,
        code: match.room?.code ?? match.id.replace(/-/g, '').slice(0, 6).toUpperCase(),
        type: match.type,
        mode: match.ratingEligible ? 'RANKED' : 'CASUAL',
        status: match.status,
        ratingEligible: match.ratingEligible,
        startedAt: match.startedAt,
        expiresAt: match.expiresAt,
        finishedAt: match.finishedAt,
        finishReason: match.finishReason,
        resultType: match.resultType,
        winnerId: match.winnerId,
        readyDeadline: awaitingReady ? match.readyDeadline : null,
        // Lets the client correct for its own clock skew in the countdown.
        serverTime: new Date(),
        viewer: isParticipant ? 'PARTICIPANT' : 'SPECTATOR',
        me: player(mine),
        opponent: player(theirs),
        challenges: match.challenges.map((mc) => {
          const own = progressOf(mc, mine?.userId);
          const other = progressOf(mc, theirs?.userId);
          return {
            matchChallengeId: mc.id,
            position: mc.position,
            challenge: mc.challenge,
            myProgress: {
              status: own?.status ?? MatchChallengeStatus.NOT_STARTED,
              attempts: own?.attempts ?? 0,
              firstAttemptAt: own?.firstAttemptAt ?? null,
              solvedAt: own?.solvedAt ?? null,
              solveDurationMs: own?.solveDurationMs ?? null,
            },
            opponentProgress: {
              status: other?.status ?? MatchChallengeStatus.NOT_STARTED,
              solvedAt: other?.solvedAt ?? null,
            },
          };
        }),
        log: this.buildLog(match),
      },
    };
  }

  /**
   * GET /matches/:matchId/challenges - the problem statements. Only public
   * sample tests are selected; hidden tests, the reference solution, custom
   * checker and generator are never read by this query at all.
   */
  async getChallenges(matchId: string, viewer: MatchViewer) {
    await this.assertCanView(matchId, viewer);
    const rows = await this.prisma.matchChallenge.findMany({
      where: { matchId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        position: true,
        challenge: {
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            difficulty: true,
            functionName: true,
            parameters: true,
            returnType: true,
            starterCode: true,
            timeLimitMs: true,
            memoryLimitMb: true,
            outputLimitKb: true,
            testCases: {
              where: { isHidden: false },
              orderBy: { order: 'asc' },
              select: { order: true, input: true, expectedOutput: true },
            },
          },
        },
      },
    });

    return {
      success: true,
      matchId,
      challenges: rows.map((row) => {
        const { testCases, timeLimitMs, memoryLimitMb, outputLimitKb, ...challenge } =
          row.challenge;
        return {
          matchChallengeId: row.id,
          position: row.position,
          challenge: {
            ...challenge,
            limits: { timeLimitMs, memoryLimitMb, outputLimitKb },
            sampleTestCases: testCases,
          },
        };
      }),
    };
  }

  /** GET /matches/:matchId/progress - solved counts, derived from progress rows. */
  async getProgress(matchId: string, viewer: MatchViewer) {
    const match = await this.assertCanView(matchId, viewer);
    const standings = await loadStandings(this.prisma, matchId);
    return {
      success: true,
      progress: { matchId, status: match.status, total: standings.total, players: standings.players },
    };
  }

  /**
   * The match this user is playing, if any. The battle page and the app shell
   * use it to put a player back into their game after a refresh or reconnect.
   */
  async getActiveMatchForUser(userId: string) {
    const participant = await this.prisma.matchParticipant.findFirst({
      where: { userId, match: { status: { in: ACTIVE_MATCH_STATUSES } } },
      orderBy: { joinedAt: 'desc' },
      select: {
        match: { select: { id: true, status: true, type: true, roomId: true } },
      },
    });
    return { success: true, match: participant?.match ?? null };
  }

  /**
   * GET /matches/me/history - the profile page's "Recent Matches" list.
   * Finished matches only, newest first. Rating delta comes from
   * RatingHistory and is null for casual (private-room) matches, which never
   * get a row there.
   */
  async getMatchHistoryForUser(userId: string, page = 1, pageSize = 10) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));

    const where: Prisma.MatchParticipantWhereInput = {
      userId,
      match: { status: MatchStatus.FINISHED },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.matchParticipant.count({ where }),
      this.prisma.matchParticipant.findMany({
        where,
        orderBy: { match: { finishedAt: 'desc' } },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          match: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      profile: { select: { displayName: true, avatarUrl: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const matchIds = rows.map((r) => r.matchId);
    const ratingHistory = matchIds.length
      ? await this.prisma.ratingHistory.findMany({
          where: { userId, matchId: { in: matchIds } },
          select: { matchId: true, change: true },
        })
      : [];
    const deltaByMatchId = new Map(ratingHistory.map((r) => [r.matchId, r.change]));

    const matches = rows.map((row) => {
      const { match } = row;
      const opponent = match.participants.find((p) => p.userId !== userId) ?? null;
      const result: 'WIN' | 'LOSS' | 'DRAW' =
        match.resultType === MatchResultType.DRAW
          ? 'DRAW'
          : match.winnerId === userId
            ? 'WIN'
            : 'LOSS';

      return {
        matchId: match.id,
        type: match.type,
        ratingEligible: match.ratingEligible,
        finishedAt: match.finishedAt,
        result,
        ratingDelta: deltaByMatchId.get(match.id) ?? null,
        ratingAfter: row.ratingAfter ?? row.ratingBefore,
        opponent: opponent
          ? {
              id: opponent.userId,
              username: opponent.user.username,
              displayName: opponent.user.profile?.displayName ?? null,
              avatarUrl: opponent.user.profile?.avatarUrl ?? null,
            }
          : null,
      };
    });

    return {
      success: true,
      matches,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      },
    };
  }

  private async assertCanView(matchId: string, viewer: MatchViewer) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true, participants: { select: { userId: true } } },
    });
    if (!match) throw new MatchNotFoundException();
    const isParticipant = match.participants.some((p) => p.userId === viewer.id);
    if (!isParticipant && !roleAtLeast(viewer.role, Role.ADMIN)) {
      throw new MatchAccessDeniedException();
    }
    return match;
  }

  /**
   * Assembled from timestamps already stored on the match - there is no
   * separate event table to keep in sync.
   */
  private buildLog(match: MatchForView): MatchLogEntry[] {
    if (!match.startedAt) return [];
    const start = match.startedAt.getTime();
    const entry = (at: Date, rest: Omit<MatchLogEntry, 'at' | 'offsetMs'>): MatchLogEntry => ({
      at,
      offsetMs: Math.max(0, at.getTime() - start),
      ...rest,
    });

    const events: MatchLogEntry[] = [entry(match.startedAt, { type: 'MATCH_STARTED' })];
    for (const mc of match.challenges) {
      for (const p of mc.progress) {
        if (p.status === MatchChallengeStatus.SOLVED && p.solvedAt) {
          events.push(
            entry(p.solvedAt, {
              type: 'CHALLENGE_SOLVED',
              userId: p.userId,
              matchChallengeId: mc.id,
              challengeTitle: mc.challenge.title,
            }),
          );
        }
      }
    }
    for (const p of match.participants) {
      if (p.gaveUpAt) events.push(entry(p.gaveUpAt, { type: 'PLAYER_GAVE_UP', userId: p.userId }));
    }
    if (match.finishedAt) {
      events.push(
        entry(match.finishedAt, {
          type: match.status === MatchStatus.CANCELLED ? 'MATCH_CANCELLED' : 'MATCH_FINISHED',
          winnerId: match.winnerId,
          resultType: match.resultType,
          finishReason: match.finishReason,
        }),
      );
    }
    return events.sort((a, b) => a.offsetMs - b.offsetMs);
  }
}
