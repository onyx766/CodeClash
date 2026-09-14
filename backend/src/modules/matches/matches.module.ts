import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchSelectionService } from './match-selection.service';
import { MatchFinalizationService } from './match-finalization.service';
import { MatchTimeoutService } from './match-timeout.service';
import { DatabaseModule } from '../../database/database.module';
import { SocketModule } from '../../socket/socket.module';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [DatabaseModule, ConfigModule, SocketModule, RatingModule],
  providers: [
    MatchesService,
    MatchSelectionService,
    MatchFinalizationService,
    MatchTimeoutService,
  ],
  controllers: [MatchesController],
  // Rooms/Matchmaking start battles; Submissions turns verdicts into progress.
  exports: [MatchesService, MatchFinalizationService],
})
export class MatchesModule {}
