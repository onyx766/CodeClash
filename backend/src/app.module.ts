import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
        // Comma-separated list of allowed CORS origins (e.g. localhost plus
        // a LAN/VPN IP for browsing from another device in dev).
        FRONTEND_URL: Joi.string().default('http://localhost:3000'),
        // Origins for the separate admin console (admin/, a second Next.js
        // app). Kept apart from FRONTEND_URL so the player frontend and the
        // admin console can be locked to different hosts in production.
        ADMIN_FRONTEND_URL: Joi.string().default(
          'http://localhost:3001,http://localhost:7662',
        ),
        TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(0),
        GEOLOCATION_PROVIDER: Joi.string()
          .valid('ip-api', 'ipapi')
          .default('ip-api'),
        GEOLOCATION_API_KEY: Joi.string().allow('').optional(),
        GEOLOCATION_TIMEOUT_MS: Joi.number().integer().min(0).default(2000),
        GEOLOCATION_DEV_IP: Joi.string().allow('').optional(),

        // Quick Match matchmaking (see modules/matchmaking). Rating-tolerance
        // widening schedule, in rating points, keyed by wait time.
        MATCHMAKING_RANGE_INITIAL: Joi.number().integer().min(1).default(100),
        MATCHMAKING_RANGE_10S: Joi.number().integer().min(1).default(150),
        MATCHMAKING_RANGE_20S: Joi.number().integer().min(1).default(250),
        MATCHMAKING_RANGE_30S: Joi.number().integer().min(1).default(400),
        MATCHMAKING_RANGE_MAX: Joi.number().integer().min(1).default(600),
        // Background pairing loop cadence and per-tick batch size.
        MATCHMAKING_TICK_MS: Joi.number().integer().min(100).default(1000),
        MATCHMAKING_MAX_PER_TICK: Joi.number().integer().min(1).default(50),
        // TTL for the short Redis reservation held between an atomic pair
        // claim and the Postgres Match being created.
        MATCHMAKING_RESERVATION_TTL_SECONDS: Joi.number()
          .integer()
          .min(1)
          .default(20),
        // A searching user is dropped from the queue if we haven't heard
        // from them (socket connect, or a status poll) for this long -
        // covers both the disconnect grace period and general staleness.
        MATCHMAKING_STALE_TIMEOUT_MS: Joi.number()
          .integer()
          .min(1000)
          .default(10_000),
        // Soft repeat-opponent avoidance window.
        MATCHMAKING_RECENT_OPPONENT_TTL_SECONDS: Joi.number()
          .integer()
          .min(0)
          .default(1800),
        // How long both players have to confirm ready after a match is found.
        MATCH_READY_TIMEOUT_SECONDS: Joi.number().integer().min(1).default(10),

        // Five-challenge battle engine (see modules/matches). Every match gets
        // exactly MATCH_CHALLENGE_COUNT distinct challenges; the per-difficulty
        // counts are preferences, with the nearest difficulty filling gaps.
        MATCH_CHALLENGE_COUNT: Joi.number().integer().min(1).default(5),
        MATCH_EASY_COUNT: Joi.number().integer().min(0).default(2),
        MATCH_MEDIUM_COUNT: Joi.number().integer().min(0).default(2),
        MATCH_HARD_COUNT: Joi.number().integer().min(0).default(1),
        MATCH_EXPERT_COUNT: Joi.number().integer().min(0).default(0),
        MATCH_DURATION_MINUTES: Joi.number().integer().min(1).default(30),
        // Only challenges whose last validation run PASSED are eligible. Set
        // false for local development with unvalidated seed data.
        MATCH_REQUIRE_VALIDATED_CHALLENGES: Joi.boolean().default(true),
        // After a match's deadline, how long to wait for submissions made
        // before it to finish judging.
        MATCH_JUDGE_GRACE_SECONDS: Joi.number().integer().min(0).default(60),

        // Isolated code runner (see code-runner/). Every submission,
        // reference solution, custom checker and generator is executed there.
        CODE_RUNNER_URL: Joi.string().default('http://localhost:5000'),
        // Shared HMAC secret with the runner (or the Docker secret file
        // /run/secrets/runner_secret). When set, every judge verdict must
        // carry a valid signature - see JudgeRunnerClient.
        RUNNER_SECRET: Joi.string().allow('').optional(),

        // Optional AI challenge-generation provider. When unset, the admin
        // console's AI mode reports itself as unavailable rather than
        // fabricating a challenge.
        AI_SERVICE_URL: Joi.string().allow('').optional(),
        AI_SERVICE_API_KEY: Joi.string().allow('').optional(),
        AI_SERVICE_TIMEOUT_MS: Joi.number().integer().min(1000).default(60_000),
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Core modules
    // Database and Redis modules provide PrismaService and RedisService
    require('./database/database.module').DatabaseModule,
    require('./redis/redis.module').RedisModule,
    require('./modules/users/users.module').UsersModule,
    require('./modules/auth/auth.module').AuthModule,
    require('./modules/challenges/challenges.module').ChallengesModule,
    require('./modules/admin-challenges/admin-challenges.module')
      .AdminChallengesModule,
    require('./modules/rooms/rooms.module').RoomsModule,
    require('./modules/invitations/invitations.module').InvitationsModule,
    require('./socket/socket.module').SocketModule,
    require('./modules/submissions/submissions.module').SubmissionsModule,
    require('./modules/matchmaking/matchmaking.module').MatchmakingModule,
    require('./modules/matches/matches.module').MatchesModule,
    require('./modules/leaderboard/leaderboard.module').LeaderboardModule,
    require('./modules/rating/rating.module').RatingModule,
    require('./modules/runner/runner.module').RunnerModule,
    require('./modules/jobs/jobs.module').JobsModule,
    require('./modules/health/health.module').HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
