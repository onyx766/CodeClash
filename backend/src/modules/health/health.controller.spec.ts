import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const build = (opts: { dbUp: boolean; redisUp: boolean }) => {
    const prisma = {
      $queryRaw: jest.fn(() =>
        opts.dbUp ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('db down')),
      ),
    };
    const redis = {
      getClient: () => ({
        ping: jest.fn(() =>
          opts.redisUp ? Promise.resolve('PONG') : Promise.reject(new Error('redis down')),
        ),
      }),
    };
    return new HealthController(prisma as never, redis as never);
  };

  it('reports ok when the database and redis respond', async () => {
    await expect(build({ dbUp: true, redisUp: true }).check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      redis: 'up',
    });
  });

  it.each([
    [{ dbUp: false, redisUp: true }, { database: 'down', redis: 'up' }],
    [{ dbUp: true, redisUp: false }, { database: 'up', redis: 'down' }],
  ])('returns 503 naming the failing component (%o)', async (opts, components) => {
    const error = await build(opts)
      .check()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'A required dependency is unavailable.',
      status: 'error',
      ...components,
    });
  });
});
