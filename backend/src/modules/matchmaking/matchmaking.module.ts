import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingController } from './matchmaking.controller';
import { MatchReadyController } from './match-ready.controller';
import { MatchmakingWorker } from './matchmaking.worker';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { SocketModule } from '../../socket/socket.module';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [DatabaseModule, RedisModule, SocketModule, RoomsModule, MatchesModule],
  providers: [MatchmakingService, MatchmakingWorker],
  controllers: [MatchmakingController, MatchReadyController],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
