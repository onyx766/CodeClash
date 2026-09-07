import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RoomAlreadyHostedException } from '../../common/exceptions/app.exception';

function makeCode(len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Every room today is created by a host and joined by code - i.e. a private
 * room. This metadata is presentation-only (not persisted) and always says
 * casual/not-rating-eligible, independent of whatever the Match/RatingService
 * layers separately enforce - see the anti-rigging plan.
 */
function withCasualMetadata<T>(room: T) {
  return {
    ...room,
    type: 'PRIVATE_ROOM' as const,
    mode: 'CASUAL' as const,
    ratingEligible: false,
    ratingMessage: 'Private room matches do not affect rating.',
  };
}

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  private async ensureUniqueCode() {
    for (let i = 0; i < 5; i++) {
      const code = makeCode(6);
      const existing = await this.prisma.room.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('Unable to generate room code');
  }

  async createRoom(hostId: string, maxPlayers = 2) {
    const existing = await this.prisma.room.findFirst({
      where: { hostId, status: { not: 'FINISHED' } },
    });
    if (existing) throw new RoomAlreadyHostedException();

    const code = await this.ensureUniqueCode();
    const room = await this.prisma.room.create({ data: { hostId, code, maxPlayers } });
    await this.prisma.roomPlayer.create({ data: { roomId: room.id, userId: hostId } });
    const client = this.redis.getClient();
    await client.sadd(`room:${room.id}:players`, hostId);
    await client.expire(`room:${room.id}:players`, 60 * 60 * 24);
    return withCasualMetadata(room);
  }

  async joinRoomByCode(userId: string, code: string) {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room) throw new NotFoundException('Room not found');
    return this.joinRoomById(userId, room.id);
  }

  async joinRoomById(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    const players = await this.prisma.roomPlayer.count({ where: { roomId: room.id } });
    if (players >= room.maxPlayers) throw new BadRequestException('Room is full');
    const already = await this.prisma.roomPlayer.findFirst({ where: { roomId: room.id, userId } });
    if (already) throw new BadRequestException('Player already in room');
    const rp = await this.prisma.roomPlayer.create({ data: { roomId: room.id, userId } });
    const client = this.redis.getClient();
    await client.sadd(`room:${room.id}:players`, userId);
    await client.expire(`room:${room.id}:players`, 60 * 60 * 24);
    return { room: withCasualMetadata(room), player: rp };
  }

  async getRoom(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, include: { players: true } });
    if (!room) throw new NotFoundException('Room not found');
    return withCasualMetadata(room);
  }

  async listActive() {
    const rooms = await this.prisma.room.findMany({
      where: { status: 'WAITING' },
      include: {
        players: {
          include: {
            // Explicit select, never `user: true` - a room listing must never
            // expose passwordHash/email.
            user: { select: { id: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rooms.map(withCasualMetadata);
  }

  async leaveRoom(userId: string, roomId: string) {
    await this.prisma.roomPlayer.deleteMany({ where: { roomId, userId } });
    const client = this.redis.getClient();
    await client.srem(`room:${roomId}:players`, userId);
    return { success: true };
  }
}
