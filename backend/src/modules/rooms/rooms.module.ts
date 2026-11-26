import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { MatchesModule } from '../matches/matches.module';
import { SocketModule } from '../../socket/socket.module';

@Module({
  imports: [DatabaseModule, RedisModule, MatchesModule, SocketModule],
  providers: [RoomsService],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
