import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { SocketModule } from '../../socket/socket.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';

@Module({
  imports: [DatabaseModule, RedisModule, SocketModule, MatchmakingModule],
  providers: [MatchesService],
  controllers: [MatchesController],
})
export class MatchesModule {}
