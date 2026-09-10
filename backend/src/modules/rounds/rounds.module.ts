import { Module } from '@nestjs/common';
import { RoundsService } from './rounds.service';
import { RoundsController } from './rounds.controller';
import { DatabaseModule } from '../../database/database.module';
import { ConfigModule } from '@nestjs/config';
import { SocketModule } from '../../socket/socket.module';
import { MatchesModule } from '../matches/matches.module';
import { RunnerModule } from '../runner/runner.module';

@Module({
  imports: [DatabaseModule, ConfigModule, SocketModule, MatchesModule, RunnerModule],
  providers: [RoundsService],
  controllers: [RoundsController],
})
export class RoundsModule {}
