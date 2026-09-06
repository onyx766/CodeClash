import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().default(4000),
        DATABASE_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        JWT_ACCESS_SECRET: Joi.string().min(16).required(),
        JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Core modules
    // Database and Redis modules provide PrismaService and RedisService
    require('./database/database.module').DatabaseModule,
    require('./redis/redis.module').RedisModule,
    require('./modules/users/users.module').UsersModule,
    require('./modules/auth/auth.module').AuthModule,
    require('./modules/challenges/challenges.module').ChallengesModule,
    require('./modules/rooms/rooms.module').RoomsModule,
    require('./socket/socket.module').SocketModule,
    require('./modules/rounds/rounds.module').RoundsModule,
    require('./modules/matches/matches.module').MatchesModule,
    require('./modules/leaderboard/leaderboard.module').LeaderboardModule,
    require('./modules/runner/runner.module').RunnerModule,
    require('./modules/jobs/jobs.module').JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
