import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchProgressionService } from './match-progression.service';
import { MatchProgressionSweeper } from './match-progression.sweeper';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { SocketModule } from '../../socket/socket.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    SocketModule,
    MatchmakingModule,
    RatingModule,
  ],
  providers: [MatchesService, MatchProgressionService, MatchProgressionSweeper],
  controllers: [MatchesController],
  // RoundsModule drives progression from the submit path.
  exports: [MatchProgressionService],
})
export class MatchesModule {}
