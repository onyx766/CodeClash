import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RunnerModule } from '../runner/runner.module';
import { AdminChallengesController } from './admin-challenges.controller';
import { AdminChallengesService } from './admin-challenges.service';
import { ChallengeValidationService } from './challenge-validation.service';
import { ChallengeImportService } from './challenge-import.service';
import { ChallengeAiService } from './challenge-ai.service';

@Module({
  imports: [DatabaseModule, RunnerModule],
  controllers: [AdminChallengesController],
  providers: [
    AdminChallengesService,
    ChallengeValidationService,
    ChallengeImportService,
    ChallengeAiService,
  ],
  exports: [AdminChallengesService],
})
export class AdminChallengesModule {}
