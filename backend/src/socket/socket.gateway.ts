import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
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
import { isTokenRevoked } from '../modules/auth/session-revocation.util';
import type { AccessTokenPayload } from '../modules/auth/auth.types';
import { withCasualMetadata } from '../modules/rooms/room-metadata.util';

/** Room ready flags live as long as the room's player set (see RoomsService). */
const ROOM_READY_TTL_SECONDS = 60 * 60 * 24;

/**
 * What a room broadcast may contain about its players. Never `user: true`:
 * that would ship password hashes, emails and account state to every
 * subscriber. Same shape as RoomsService.getRoom.
 */
const ROOM_SNAPSHOT_INCLUDE = {
  players: { include: { user: { select: { id: true, username: true } } } },
  match: { select: { id: true, status: true } },
} as const;

const asRoomId = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;

/** Why a handshake was refused. */
export type SocketAuthErrorCode =
  'UNAUTHENTICATED' | 'ACCOUNT_BANNED' | 'SESSION_REVOKED';

/**
 * A refused handshake. Socket.IO turns a middleware error into the client's
 * connect_error with err.message = the code and err.data = { code }, and the
 * client does not retry it on its own: it renews the session and reconnects
 * (or ends the session when the renewal is refused).
 */
export class SocketAuthError extends Error {
  readonly data: { code: SocketAuthErrorCode };

  constructor(readonly code: SocketAuthErrorCode) {
    super(code);
    this.name = 'SocketAuthError';
    this.data = { code };
  }
}

/** The identity a socket is bound to, at handshake, for its whole life. */
export interface SocketUser {
  id: string;
  role: Role;
}

/** What the handshake middleware stores on an admitted socket. */
type SocketData = { user?: SocketUser };

// Reflects any origin in dev (VPN/LAN IPs change often); production is
// restricted to the configured FRONTEND_URL(s) - mirrors main.ts's HTTP CORS.
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

@WebSocketGateway({ cors: { origin: isProduction ? allowedOrigins : true, credentials: true } })
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocketGateway.name);

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

  /**
   * Drops every open socket of one user. Sockets are authenticated only at
   * handshake, so after a ban or a password change (which revokes sessions)
   * live connections must be closed for the new state to apply; clients that
   * still hold a valid session simply reconnect.
   */
  disconnectUser(userId: string) {
    this.server?.in(`user:${userId}`).disconnectSockets(true);
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

  /**
   * Authenticates every handshake before Socket.IO accepts it, instead of
   * accepting the connection and dropping it afterwards. A refused client gets
   * connect_error (see SocketAuthError); an accepted one is already bound to
   * its user when 'connect' fires, so whatever it emits from its connect
   * handler is handled as that user. This gateway has no namespace, so Nest
   * passes the root Server and use() guards the default namespace.
   */
  afterInit(server: Server) {
    server.use((client, next) => {
      void this.authenticate(client).then(
        (user) => {
          (client.data as SocketData).user = user;
          next();
          void this.recordConnect(client.id, user.id);
        },
        (err: unknown) => next(this.refusal(err)),
      );
    });
  }

  /**
   * The handshake's identity, with the same standing checks as the HTTP
   * JwtStrategy: the account must exist and not be banned, and the token must
   * not predate a revocation of the account's sessions.
   */
  private async authenticate(client: Socket): Promise<SocketUser> {
    const token = this.extractToken(client);
    if (!token) throw new SocketAuthError('UNAUTHENTICATED');
    let payload: AccessTokenPayload;
    try {
      payload = this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new SocketAuthError('UNAUTHENTICATED');
    }
    if (payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw new SocketAuthError('UNAUTHENTICATED');
    }
    const account = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, status: true, sessionsRevokedAt: true },
    });
    if (!account) throw new SocketAuthError('UNAUTHENTICATED');
    if (account.status === UserStatus.BANNED) {
      throw new SocketAuthError('ACCOUNT_BANNED');
    }
    if (isTokenRevoked(payload.iat, account.sessionsRevokedAt)) {
      throw new SocketAuthError('SESSION_REVOKED');
    }
    // Role from the database, not the token, like the HTTP JwtStrategy.
    return { id: payload.sub, role: account.role };
  }

  /** What a failed handshake check is reported as. */
  private refusal(err: unknown): SocketAuthError {
    if (err instanceof SocketAuthError) return err;
    // Not a verdict on the session (the database was unreachable, say):
    // answered like a missing session, so the client renews and retries.
    this.logger.error(
      'Socket handshake check failed',
      err instanceof Error ? err.stack : err,
    );
    return new SocketAuthError('UNAUTHENTICATED');
  }

  /** Best-effort: Redis trouble must not cost an authenticated player their socket. */
  private async recordConnect(socketId: string, userId: string) {
    try {
      const r = this.redis.getClient();
      await r.set(`player:${userId}:presence`, socketId, 'EX', 60 * 60);
      // Refresh matchmaking queue staleness tracking on (re)connect - a
      // no-op if this user isn't currently searching. See MatchmakingService.
      const staleTimeoutMs = loadMatchmakingConfig(this.config).staleTimeoutMs;
      await touchLastSeen(r, userId, staleTimeoutMs);
    } catch (err) {
      this.logger.warn(
        `Could not record the connection of ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Runs, synchronously, as a socket the handshake middleware admitted
   * connects - before the client sees 'connect'.
   */
  handleConnection(client: Socket) {
    const { user } = client.data as SocketData;
    if (!user) {
      // Unreachable while afterInit's middleware guards the namespace.
      client.disconnect(true);
      return;
    }
    // Lets the server push events to this user regardless of which room
    // (if any) they're currently viewing - used by matchmaking notifications.
    void client.join(`user:${user.id}`);
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

  /**
   * Subscribe to a private room's live updates. Only the room's own players
   * may subscribe; the snapshot is broadcast to everyone already subscribed.
   */
  @SubscribeMessage(SocketEvents.ROOM_JOIN)
  async onRoomJoin(client: Socket, payload: { roomId?: unknown }) {
    const user = client.data.user;
    const roomId = asRoomId(payload?.roomId);
    if (!user || !roomId) return { ok: false, error: 'INVALID_REQUEST' };
    if (!(await this.isRoomPlayer(roomId, user.id))) {
      return { ok: false, error: 'ROOM_ACCESS_DENIED' };
    }
    await client.join(`room:${roomId}`);
    await this.broadcastRoom(roomId);
    return { ok: true };
  }

  /**
   * Only unsubscribes this socket from the room's broadcasts. The room page
   * emits it on every unmount, including plain navigation away while the room
   * should stay open; actually leaving or cancelling a room is a deliberate
   * POST /rooms/:id/leave, so nothing about the room changes here.
   */
  @SubscribeMessage(SocketEvents.ROOM_LEAVE)
  async onRoomLeave(client: Socket, payload: { roomId?: unknown }) {
    const roomId = asRoomId(payload?.roomId);
    if (roomId) await client.leave(`room:${roomId}`);
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.ROOM_READY)
  async onRoomReady(client: Socket, payload: { roomId?: unknown; ready?: unknown }) {
    const user = client.data.user;
    const roomId = asRoomId(payload?.roomId);
    if (!user || !roomId) return { ok: false, error: 'INVALID_REQUEST' };
    if (!(await this.isRoomPlayer(roomId, user.id))) {
      return { ok: false, error: 'ROOM_ACCESS_DENIED' };
    }
    const r = this.redis.getClient();
    const key = `room:${roomId}:ready`;
    await r.hset(key, user.id, payload.ready === true ? '1' : '0');
    await r.expire(key, ROOM_READY_TTL_SECONDS);
    await this.broadcastRoom(roomId);
    return { ok: true };
  }

  private async isRoomPlayer(roomId: string, userId: string): Promise<boolean> {
    const player = await this.prisma.roomPlayer.findFirst({
      where: { roomId, userId },
      select: { id: true },
    });
    return !!player;
  }

  /**
   * Pushes the room's current snapshot to its subscribers - or
   * { room: null } once the room is gone (host left or cancelled), which
   * clients treat as "return to the lobby". Called by the room:* handlers and
   * by RoomsService after joins and leaves made over HTTP.
   */
  async broadcastRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: ROOM_SNAPSHOT_INCLUDE,
    });
    const ready = await this.redis.getClient().hgetall(`room:${roomId}:ready`);
    this.server
      .to(`room:${roomId}`)
      .emit(SocketEvents.ROOM_UPDATE, { room: room ? withCasualMetadata(room) : null, ready });
  }
}
