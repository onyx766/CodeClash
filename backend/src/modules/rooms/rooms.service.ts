import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RoomAlreadyHostedException } from '../../common/exceptions/app.exception';

const ROOM_TTL_MS = 30 * 60 * 1000;

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

  /**
   * A room only expires while it's still waiting for a match to start - once
   * one exists (win, loss, or abandonment) the TTL no longer applies.
   */
  private isExpired(room: { expiresAt: Date | null; match?: unknown }) {
    return !room.match && !!room.expiresAt && room.expiresAt.getTime() < Date.now();
  }

  private async deleteRoomCascade(roomId: string) {
    await this.prisma.$transaction([
      this.prisma.roomInvitation.deleteMany({ where: { roomId } }),
      this.prisma.roomPlayer.deleteMany({ where: { roomId } }),
      this.prisma.room.delete({ where: { id: roomId } }),
    ]);
    const client = this.redis.getClient();
    await client.del(`room:${roomId}:players`);
    await client.del(`room:${roomId}:ready`);
  }

  async createRoom(hostId: string, maxPlayers = 2) {
    const existing = await this.prisma.room.findFirst({
      where: { hostId, status: { not: 'FINISHED' } },
      include: { match: { select: { id: true } } },
    });
    if (existing) {
      if (!this.isExpired(existing)) throw new RoomAlreadyHostedException();
      await this.deleteRoomCascade(existing.id);
    }

    const code = await this.ensureUniqueCode();
    const expiresAt = new Date(Date.now() + ROOM_TTL_MS);
    const room = await this.prisma.room.create({ data: { hostId, code, maxPlayers, expiresAt } });
    await this.prisma.roomPlayer.create({ data: { roomId: room.id, userId: hostId } });
    const client = this.redis.getClient();
    await client.sadd(`room:${room.id}:players`, hostId);
    await client.expire(`room:${room.id}:players`, 60 * 60 * 24);
    return withCasualMetadata(room);
  }

  async joinRoomByCode(userId: string, code: string) {
    const room = await this.prisma.room.findUnique({
      where: { code },
      include: { match: { select: { id: true } } },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (this.isExpired(room)) {
      await this.deleteRoomCascade(room.id);
      throw new NotFoundException('Room not found');
    }
    return this.joinRoomById(userId, room.id);
  }

  async joinRoomById(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { match: { select: { id: true } } },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (this.isExpired(room)) {
      await this.deleteRoomCascade(room.id);
      throw new NotFoundException('Room not found');
    }
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
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        players: { include: { user: { select: { id: true, username: true } } } },
        match: { select: { id: true } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (this.isExpired(room)) {
      await this.deleteRoomCascade(room.id);
      throw new NotFoundException('Room not found');
    }
    return withCasualMetadata(room);
  }

  async listActive() {
    const rooms = await this.prisma.room.findMany({
      where: {
        status: 'WAITING',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
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

  /**
   * A player is only ever in one non-finished room at a time (createRoom
   * enforces one hosted room, joinRoomById rejects duplicate joins), so the
   * first match is the room to redirect them back to.
   */
  async findActiveRoomForUser(userId: string) {
    const roomPlayer = await this.prisma.roomPlayer.findFirst({
      where: { userId, room: { status: { not: 'FINISHED' } } },
      include: { room: { include: { match: { select: { id: true } } } } },
      orderBy: { joinedAt: 'desc' },
    });
    if (!roomPlayer) return null;
    if (this.isExpired(roomPlayer.room)) {
      await this.deleteRoomCascade(roomPlayer.room.id);
      return null;
    }
    return withCasualMetadata(roomPlayer.room);
  }

  /**
   * Removes the player from the room. A private room can't continue without
   * its host, so the host leaving (or the room becoming empty) deletes it
   * outright rather than leaving an abandoned room that blocks them from
   * hosting a new one.
   */
  async leaveRoom(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return { success: true };

    await this.prisma.roomPlayer.deleteMany({ where: { roomId, userId } });
    const client = this.redis.getClient();
    await client.srem(`room:${roomId}:players`, userId);

    const remaining = await this.prisma.roomPlayer.count({ where: { roomId } });
    if (userId === room.hostId || remaining === 0) {
      await this.deleteRoomCascade(roomId);
    }
    return { success: true };
  }
}
