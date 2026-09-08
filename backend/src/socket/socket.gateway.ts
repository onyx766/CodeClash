import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { parse as parseCookies } from 'cookie';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';
import { RoomsService } from '../modules/rooms/rooms.service';
import { SocketEvents } from './socket.events';
import { ACCESS_TOKEN_COOKIE } from '../common/constants/auth.constants';
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
    private rooms: RoomsService,
  ) {}

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

  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (user) {
      const r = this.redis.getClient();
      await r.del(`player:${user.id}:presence`);
      this.server.emit(SocketEvents.ROOM_UPDATE, { userDisconnected: user.id });
    }
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
    // Actually removes the player (and, if they were the host or the last
    // one in it, the room itself) - previously this only left the socket.io
    // broadcast group, so cancelled/abandoned rooms never freed up the host.
    await this.rooms.leaveRoom(user.id, payload.roomId);
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
