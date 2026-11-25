import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { RunnerModule } from '../runner/runner.module';
import { AdminChallengesController } from './admin-challenges.controller';
import { AdminChallengesService } from './admin-challenges.service';
import { ChallengeValidationService } from './challenge-validation.service';
import { ChallengeImportService } from './challenge-import.service';
import { ChallengeAiService } from './challenge-ai.service';
import { ChallengeBattlePoolService } from './battle-pool.service';
import { ChallengePoolBootstrapService } from './challenge-pool-bootstrap.service';

@Module({
  imports: [DatabaseModule, RedisModule, RunnerModule],
  controllers: [AdminChallengesController],
  providers: [
    AdminChallengesService,
    ChallengeValidationService,
    ChallengeImportService,
    ChallengeAiService,
    ChallengeBattlePoolService,
    ChallengePoolBootstrapService,
  ],
  exports: [AdminChallengesService],
})
export class AdminChallengesModule {}
