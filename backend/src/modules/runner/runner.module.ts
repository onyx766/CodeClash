import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { RunnerController } from './runner.controller';
import { JudgeRunnerClient } from './judge-runner.client';

@Module({
  imports: [RedisModule],
  controllers: [RunnerController],
  providers: [JudgeRunnerClient],
  exports: [JudgeRunnerClient],
})
export class RunnerModule {}
