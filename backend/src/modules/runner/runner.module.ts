import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { RunnerController } from './runner.controller';

@Module({
  imports: [RedisModule],
  controllers: [RunnerController],
})
export class RunnerModule {}
