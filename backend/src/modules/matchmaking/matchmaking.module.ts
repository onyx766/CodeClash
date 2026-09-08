import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingWorker } from './matchmaking.worker';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { SocketModule } from '../../socket/socket.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [DatabaseModule, RedisModule, SocketModule, RoomsModule],
  providers: [MatchmakingService, MatchmakingWorker],
  controllers: [MatchmakingController],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
