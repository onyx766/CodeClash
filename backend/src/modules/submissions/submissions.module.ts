import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SocketModule } from '../../socket/socket.module';
import { MatchesModule } from '../matches/matches.module';
import { RunnerModule } from '../runner/runner.module';
import { SubmissionsService } from './submissions.service';
import { RunnerResultService } from './runner-result.service';
import { SubmissionsController } from './submissions.controller';

@Module({
  imports: [DatabaseModule, SocketModule, MatchesModule, RunnerModule],
  providers: [SubmissionsService, RunnerResultService],
  controllers: [SubmissionsController],
})
export class SubmissionsModule {}
