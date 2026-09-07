import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [RoomsService],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
