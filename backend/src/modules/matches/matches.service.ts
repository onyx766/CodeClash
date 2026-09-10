import { Injectable, BadRequestException } from '@nestjs/common';
import { MatchType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { pickRandom } from '../matchmaking/matchmaking.util';
import {
  MatchNotFoundException,
  NotAMatchParticipantException,
} from '../../common/exceptions/app.exception';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private socket: SocketGateway,
  ) {}

  async startMatch(roomId: string, initiatorId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { players: true },
    });
    if (!room) throw new BadRequestException('Room not found');
    if (room.players.length < 2)
      throw new BadRequestException('Need 2 players to start');

    // check ready flags in Redis
    const r = this.redis.getClient();
    const ready = await r.hgetall(`room:${roomId}:ready`);
    const allReady = room.players.every((p) => ready[p.userId] === '1');
    if (!allReady) throw new BadRequestException('Not all players are ready');

    // pick challenges
    const totalRounds = 3;
    const challenges = await this.prisma.challenge.findMany({
      where: { isPublished: true },
    });
    if (challenges.length < totalRounds)
      throw new BadRequestException('Not enough published challenges');
    const picks = pickRandom(challenges, totalRounds);

    // Every match today originates from a host-created, code-joined room, i.e.
    // a private room. Hardcoded server-side - never derived from client input -
    // so a private room can never become rating-eligible by accident or by a
    // forged request body. See RatingService for the independent enforcement
    // of this rule at rating-application time.
    const match = await this.prisma.match.create({
      data: {
        roomId,
        status: 'IN_PROGRESS',
        totalRounds,
        type: 'PRIVATE_ROOM',
        ratingEligible: false,
        ratingReason: 'PRIVATE_ROOM_CASUAL',
      },
    });

    const rounds: any[] = [];
    const now = new Date();
    let rn = 1;
    for (const c of picks) {
      // Only round 1 is scheduled up front. Rounds 2+ are created unscheduled
      // and are given their startedAt/endsAt by
      // MatchProgressionService.startNextRound as the previous round closes -
      // scheduling them all from match start would leave them expired before
      // players ever reached them.
      const isFirst = rn === 1;
      const startedAt = isFirst ? now : null;
      const endsAt = isFirst
        ? new Date(now.getTime() + (c.timeLimitSeconds || 300) * 1000)
        : null;
      const round = await this.prisma.round.create({
        data: {
          matchId: match.id,
          challengeId: c.id,
          roundNumber: rn,
          startedAt,
          endsAt,
        },
      });
      rounds.push(round);
      rn++;
    }

    // update match currentRoundNumber
    await this.prisma.match.update({
      where: { id: match.id },
      data: { currentRoundNumber: 1, startedAt: new Date() },
    });

    // broadcast match start and round start
    this.socket.server
      .to(`room:${roomId}`)
      .emit('match:start', { matchId: match.id });
    this.socket.server
      .to(`room:${roomId}`)
      .emit('round:start', { round: rounds[0] });

    return { match, rounds };
  }

  /**
   * Everything a client needs to render (or re-render, after a refresh or a
   * reconnect) a match it is playing. This is the only way a player gets the
   * challenge text and starter code - `round:start` intentionally carries just
   * identifiers, so a client that missed the socket event still recovers by
   * calling this.
   *
   * Two things are deliberately withheld:
   *   - hidden test cases, which never leave the server (they are the whole
   *     defence against a player tuning code until it satisfies the grader);
   *   - the opponent's code and score for a round that is still open. Those
   *     appear only once the round has closed.
   */
  async getMatchState(matchId: string, viewerId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: { include: { user: { select: { id: true, username: true } } } },
        room: { include: { players: { include: { user: { select: { id: true, username: true } } } } } },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            submissions: true,
            challenge: {
              include: { testCases: { where: { isHidden: false } } },
            },
          },
        },
      },
    });
    if (!match) throw new MatchNotFoundException();

    const players =
      match.type === MatchType.QUICK_MATCH
        ? match.participants.map((p) => ({
            userId: p.userId,
            username: p.user.username,
            ratingBefore: p.ratingBefore,
            ratingAfter: p.ratingAfter,
          }))
        : (match.room?.players ?? []).map((p) => ({
            userId: p.userId,
            username: p.user.username,
            ratingBefore: null,
            ratingAfter: null,
          }));

    if (!players.some((p) => p.userId === viewerId)) {
      throw new NotAMatchParticipantException();
    }

    const currentRound =
      match.rounds.find((r) => r.roundNumber === match.currentRoundNumber) ??
      null;
    const currentRoundOpen = !!currentRound && !currentRound.finishedAt;

    return {
      id: match.id,
      type: match.type,
      status: match.status,
      ratingEligible: match.ratingEligible,
      currentRoundNumber: match.currentRoundNumber,
      totalRounds: match.totalRounds,
      winnerId: match.winnerId,
      startedAt: match.startedAt,
      finishedAt: match.finishedAt,
      players,
      currentRound: currentRound
        ? {
            id: currentRound.id,
            roundNumber: currentRound.roundNumber,
            startedAt: currentRound.startedAt,
            endsAt: currentRound.endsAt,
            finishedAt: currentRound.finishedAt,
            // Has this viewer already used their one submission this round?
            hasSubmitted: currentRound.submissions.some(
              (s) => s.userId === viewerId,
            ),
            opponentSubmitted: currentRound.submissions.some(
              (s) => s.userId !== viewerId,
            ),
            challenge: {
              id: currentRound.challenge.id,
              title: currentRound.challenge.title,
              description: currentRound.challenge.description,
              difficulty: currentRound.challenge.difficulty,
              starterCode: currentRound.challenge.starterCode,
              functionName: currentRound.challenge.functionName,
              timeLimitSeconds: currentRound.challenge.timeLimitSeconds,
              // Public samples only - hidden cases are filtered in the query
              // above so they cannot reach the browser.
              sampleTestCases: currentRound.challenge.testCases.map((t) => ({
                input: t.input,
                expectedOutput: t.expectedOutput,
              })),
            },
          }
        : null,
      // Closed rounds are fully revealed; an open round only ever reports the
      // viewer's own result.
      rounds: match.rounds.map((round) => {
        const closed = !!round.finishedAt;
        const visible = closed
          ? round.submissions
          : round.submissions.filter((s) => s.userId === viewerId);
        return {
          id: round.id,
          roundNumber: round.roundNumber,
          challengeTitle: closed || round.id === currentRound?.id
            ? round.challenge.title
            : null,
          startedAt: round.startedAt,
          endsAt: round.endsAt,
          finishedAt: round.finishedAt,
          winnerId: closed ? round.winnerId : null,
          results: visible.map((s) => ({
            userId: s.userId,
            score: s.score,
            passedTests: s.passedTests,
            totalTests: s.totalTests,
            runtimeMs: s.runtimeMs,
            submittedAt: s.submittedAt,
          })),
        };
      }),
      roundWins: players.map((p) => ({
        userId: p.userId,
        wins: match.rounds.filter(
          (r) => r.finishedAt && r.winnerId === p.userId,
        ).length,
      })),
      currentRoundOpen,
    };
  }

  /** The match this user is currently playing, if any - used to bounce a
   * reconnecting player straight back into their game. */
  async getActiveMatchForUser(userId: string) {
    const match = await this.prisma.match.findFirst({
      where: {
        status: { in: ['PENDING_READY', 'READY', 'IN_PROGRESS'] },
        OR: [
          { participants: { some: { userId } } },
          { room: { players: { some: { userId } } } },
        ],
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, type: true },
    });
    return { match };
  }
}
