import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import { parse as parseCookies } from 'cookie';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';
import { SocketEvents, matchChannel } from './socket.events';
import { ACCESS_TOKEN_COOKIE } from '../common/constants/auth.constants';
import { roleAtLeast } from '../common/constants/role-hierarchy';
import { touchLastSeen } from '../modules/matchmaking/matchmaking.redis';
import { loadMatchmakingConfig } from '../modules/matchmaking/matchmaking.constants';

// Reflects any origin in dev (VPN/LAN IPs change often); production is
// restricted to the configured FRONTEND_URL(s) - mirrors main.ts's HTTP CORS.
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

@WebSocketGateway({ cors: { origin: isProduction ? allowedOrigins : true, credentials: true } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  /**
   * Push an event to every socket belonging to one user, regardless of which
   * room they are currently viewing. Every client joins `user:<id>` on
   * connect (see handleConnection), so this also reaches a second tab or a
   * client that reconnected after a refresh.
   */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  /** Push to every socket that passed onMatchJoin's membership check. */
  emitToMatch(matchId: string, event: string, payload: unknown) {
    this.server.to(matchChannel(matchId)).emit(event, payload);
  }

  /**
   * Auth is cookie-based (httpOnly access-token cookie), not a bearer token
   * the browser could hand us explicitly - so the handshake carries no
   * `auth.token` in normal operation. Read the cookie the browser attached to
   * the handshake request instead, falling back to auth/header token for
   * non-browser clients.
   */
  private extractToken(client: Socket): string | null {
    const explicit =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.toString().replace('Bearer ', '');
    if (explicit) return explicit;
    const cookieHeader = client.handshake.headers?.cookie;
    if (!cookieHeader) return null;
    return parseCookies(cookieHeader)[ACCESS_TOKEN_COOKIE] ?? null;
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) return client.disconnect();
      const payload: any = this.jwt.verify(token, { secret: this.config.get('JWT_ACCESS_SECRET') });
      if (payload.type !== 'access') return client.disconnect();
      client.data.user = { id: payload.sub, role: payload.role };
      // Lets the server push events to this user regardless of which room
      // (if any) they're currently viewing - used by matchmaking notifications.
      client.join(`user:${payload.sub}`);
      const r = this.redis.getClient();
      await r.set(`player:${payload.sub}:presence`, client.id, 'EX', 60 * 60);
      // Refresh matchmaking queue staleness tracking on (re)connect - a
      // no-op if this user isn't currently searching. See MatchmakingService.
      const staleTimeoutMs = loadMatchmakingConfig(this.config).staleTimeoutMs;
      await touchLastSeen(r, payload.sub, staleTimeoutMs);
      this.server.emit(SocketEvents.ROOM_UPDATE, { userConnected: payload.sub });
    } catch (err) {
      client.disconnect();
    }
  }

  /**
   * Deliberately does not touch any match. A dropped socket (refresh, flaky
   * network) must not forfeit a battle: the match lives in PostgreSQL, its
   * clock keeps running server-side, and the client recovers with
   * GET /matches/:id plus a fresh match:join.
   */
  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (user) {
      const r = this.redis.getClient();
      await r.del(`player:${user.id}:presence`);
      this.server.emit(SocketEvents.ROOM_UPDATE, { userDisconnected: user.id });
    }
  }

  /**
   * Subscribe to a match's live events. The identity is the one authenticated
   * at handshake (JWT cookie) - any userId in the payload is ignored - and it
   * must belong to a participant, or to an active ADMIN/MASTER spectating.
   * Acks { ok } so the client knows whether it is subscribed.
   */
  @SubscribeMessage(SocketEvents.MATCH_JOIN)
  async onMatchJoin(client: Socket, payload: { matchId?: unknown }) {
    const user = client.data.user;
    const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null;
    if (!user || !matchId) return { ok: false, error: 'INVALID_REQUEST' };
    if (!(await this.canWatchMatch(user.id, matchId))) {
      return { ok: false, error: 'MATCH_ACCESS_DENIED' };
    }
    await client.join(matchChannel(matchId));
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.MATCH_LEAVE)
  async onMatchLeave(client: Socket, payload: { matchId?: unknown }) {
    if (typeof payload?.matchId === 'string') await client.leave(matchChannel(payload.matchId));
    return { ok: true };
  }

  private async canWatchMatch(userId: string, matchId: string): Promise<boolean> {
    const participant = await this.prisma.matchParticipant.findUnique({
      where: { matchId_userId: { matchId, userId } },
      select: { id: true },
    });
    if (participant) return true;
    // Role from the database, not the token, so a demotion or ban applies now.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    return !!user && user.status === UserStatus.ACTIVE && roleAtLeast(user.role, Role.ADMIN);
  }

  @SubscribeMessage(SocketEvents.ROOM_JOIN)
  async onRoomJoin(client: Socket, payload: { roomId: string }) {
    const user = client.data.user;
    if (!user) return;
    client.join(`room:${payload.roomId}`);
    const room = await this.prisma.room.findUnique({ where: { id: payload.roomId }, include: { players: { include: { user: true } } } });
    const r = this.redis.getClient();
    const ready = await r.hgetall(`room:${payload.roomId}:ready`);
    this.server.to(`room:${payload.roomId}`).emit(SocketEvents.ROOM_UPDATE, { room, ready });
  }

  @SubscribeMessage(SocketEvents.ROOM_LEAVE)
  async onRoomLeave(client: Socket, payload: { roomId: string }) {
    const user = client.data.user;
    if (!user) return;
    // This only unsubscribes the socket from the room's live broadcasts (the
    // room page emits it on every unmount, including plain navigation away
    // while still wanting to keep the room open). Actually leaving/cancelling
    // a room is a deliberate action handled by POST /rooms/:id/leave - if
    // this also called rooms.leaveRoom(), merely navigating away from the
    // room page as host would delete the room out from under the other
    // player still trying to join it.
    client.leave(`room:${payload.roomId}`);
    const room = await this.prisma.room.findUnique({ where: { id: payload.roomId }, include: { players: { include: { user: true } } } });
    const r = this.redis.getClient();
    const ready = await r.hgetall(`room:${payload.roomId}:ready`);
    this.server.to(`room:${payload.roomId}`).emit(SocketEvents.ROOM_UPDATE, { room, ready });
  }

  @SubscribeMessage(SocketEvents.ROOM_READY)
  async onRoomReady(client: Socket, payload: { roomId: string; ready: boolean }) {
    const user = client.data.user;
    if (!user) return;
    // set ready flag in Redis
    const r = this.redis.getClient();
    await r.hset(`room:${payload.roomId}:ready`, user.id, payload.ready ? '1' : '0');
    const room = await this.prisma.room.findUnique({ where: { id: payload.roomId }, include: { players: { include: { user: true } } } });
    const ready = await r.hgetall(`room:${payload.roomId}:ready`);
    this.server.to(`room:${payload.roomId}`).emit(SocketEvents.ROOM_UPDATE, { room, ready });
  }
}
