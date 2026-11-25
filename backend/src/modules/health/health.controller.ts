import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

type ComponentState = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  database: ComponentState;
  redis: ComponentState;
}

/**
 * Liveness/readiness probe for container orchestration (docker-compose
 * healthchecks, load balancers). Unauthenticated and unthrottled, and it
 * reports component state only - never connection strings or error text.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.probe(() => this.redis.getClient().ping()),
    ]);
    const report: HealthReport = {
      status: database === 'up' && redis === 'up' ? 'ok' : 'error',
      database,
      redis,
    };
    if (report.status !== 'ok') {
      // code/message keep the standard error envelope; the global filter
      // forwards the component states alongside them.
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'A required dependency is unavailable.',
        ...report,
      });
    }
    return report;
  }

  private async probe(check: () => Promise<unknown>): Promise<ComponentState> {
    try {
      await check();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
