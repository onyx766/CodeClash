import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { RoomsModule } from '../modules/rooms/rooms.module';

@Module({
  imports: [JwtModule, ConfigModule, RedisModule, DatabaseModule, RoomsModule],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {}
