import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { pickRandom } from '../matchmaking/matchmaking.util';

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
      const startedAt = new Date(now.getTime() + (rn - 1) * 1000); // immediate; front-end uses endsAt
      const endsAt = new Date(
        startedAt.getTime() + (c.timeLimitSeconds || 300) * 1000,
      );
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
}
