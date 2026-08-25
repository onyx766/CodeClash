import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';
import { SocketEvents } from './socket.events';

@WebSocketGateway({ cors: true })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwt: JwtService, private config: ConfigService, private redis: RedisService, private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.toString().replace('Bearer ', '');
      if (!token) return client.disconnect();
      const payload: any = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
      client.data.user = { id: payload.sub, email: payload.email };
      const r = this.redis.getClient();
      await r.set(`player:${payload.sub}:presence`, client.id, 'EX', 60 * 60);
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
