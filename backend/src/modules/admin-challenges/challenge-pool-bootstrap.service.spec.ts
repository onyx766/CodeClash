import { ChallengeValidationStatus } from '@prisma/client';
import { ChallengeValidationFailedException } from '../../common/exceptions/app.exception';
import {
  BOOTSTRAP_MAX_DELAY_MS,
  ChallengePoolBootstrapService,
} from './challenge-pool-bootstrap.service';

type Target = { id: string; title: string };

function setup(opts: {
  targets?: Target[];
  reachable?: boolean;
  workers?: string[];
  lockFree?: boolean;
  outcomes?: Record<string, ChallengeValidationStatus | Error>;
  env?: Record<string, string | boolean | undefined>;
} = {}) {
  const redisClient = {
    keys: jest.fn().mockResolvedValue(opts.workers ?? ['runner:worker:1']),
    set: jest.fn().mockResolvedValue(opts.lockFree === false ? null : 'OK'),
    del: jest.fn().mockResolvedValue(1),
  };
  const prisma = {
    challenge: { findMany: jest.fn().mockResolvedValue(opts.targets ?? []) },
  };
  const runner = {
    probe: jest.fn().mockResolvedValue({ reachable: opts.reachable ?? true, message: '' }),
  };
  const validation = {
    validate: jest.fn(async (id: string) => {
      const outcome = opts.outcomes?.[id] ?? ChallengeValidationStatus.PASSED;
      if (outcome instanceof Error) throw outcome;
      return { validation: { status: outcome, validatedAt: new Date(), checks: [] } };
    }),
  };
  const env: Record<string, unknown> = { NODE_ENV: 'production', ...opts.env };
  const config = { get: jest.fn((key: string) => env[key]) };

  const service = new ChallengePoolBootstrapService(
    prisma as never,
    { getClient: () => redisClient } as never,
    runner as never,
    validation as never,
    config as never,
  );
  return { service, prisma, runner, validation, redisClient };
}

const two: Target[] = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
];

describe('ChallengePoolBootstrapService', () => {
  it('only selects published, unarchived challenges that were never checked', async () => {
    const { service, prisma } = setup();
    await service.runPass();
    expect(prisma.challenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          archivedAt: null,
          validationStatus: ChallengeValidationStatus.NOT_CHECKED,
        },
      }),
    );
  });

  it('is idle when nothing needs validating, without touching the runner', async () => {
    const { service, runner } = setup({ targets: [] });
    await expect(service.runPass()).resolves.toEqual({ state: 'idle' });
    expect(runner.probe).not.toHaveBeenCalled();
  });

  it('waits when the runner service is unreachable', async () => {
    const { service, validation } = setup({ targets: two, reachable: false });
    await expect(service.runPass()).resolves.toMatchObject({ state: 'runner-unavailable' });
    expect(validation.validate).not.toHaveBeenCalled();
  });

  it('waits until a runner worker has registered', async () => {
    const { service, validation } = setup({ targets: two, workers: [] });
    await expect(service.runPass()).resolves.toMatchObject({ state: 'runner-unavailable' });
    expect(validation.validate).not.toHaveBeenCalled();
  });

  it('backs off while another instance holds the lock', async () => {
    const { service, validation } = setup({ targets: two, lockFree: false });
    await expect(service.runPass()).resolves.toEqual({ state: 'locked' });
    expect(validation.validate).not.toHaveBeenCalled();
  });

  it('validates every target in the sandbox and reports the outcome', async () => {
    const { service, validation, redisClient } = setup({
      targets: two,
      outcomes: { b: ChallengeValidationStatus.FAILED },
    });
    await expect(service.runPass()).resolves.toEqual({
      state: 'done',
      passed: 1,
      failed: 1,
      errors: 0,
    });
    expect(validation.validate).toHaveBeenCalledTimes(2);
    expect(redisClient.del).toHaveBeenCalled();
  });

  it('stops the pass and releases the lock when the runner disappears mid-way', async () => {
    const { service, validation, redisClient } = setup({
      targets: two,
      outcomes: { a: new ChallengeValidationFailedException('runner down') },
    });
    await expect(service.runPass()).resolves.toMatchObject({ state: 'runner-unavailable' });
    expect(validation.validate).toHaveBeenCalledTimes(1);
    expect(redisClient.del).toHaveBeenCalled();
  });

  it('counts unexpected errors and carries on with the rest', async () => {
    const { service } = setup({ targets: two, outcomes: { a: new Error('boom') } });
    await expect(service.runPass()).resolves.toEqual({
      state: 'done',
      passed: 1,
      failed: 0,
      errors: 1,
    });
  });

  describe('isEnabled', () => {
    it('is on by default', () => {
      expect(setup().service.isEnabled()).toBe(true);
    });
    it.each([false, 'false'])('is off when AUTO_VALIDATE_CHALLENGES=%p', (flag) => {
      expect(setup({ env: { AUTO_VALIDATE_CHALLENGES: flag } }).service.isEnabled()).toBe(false);
    });
    it('never runs under NODE_ENV=test', () => {
      expect(setup({ env: { NODE_ENV: 'test' } }).service.isEnabled()).toBe(false);
    });
  });

  it('backs off exponentially up to a ceiling', () => {
    expect(ChallengePoolBootstrapService.retryDelay(0)).toBe(10_000);
    expect(ChallengePoolBootstrapService.retryDelay(1)).toBe(20_000);
    expect(ChallengePoolBootstrapService.retryDelay(20)).toBe(BOOTSTRAP_MAX_DELAY_MS);
  });

  describe('scheduling', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('keeps polling for newly published challenges after an idle pass', async () => {
      const { service, prisma } = setup({ targets: [] });
      service.onApplicationBootstrap();

      await jest.advanceTimersByTimeAsync(5_000);
      expect(prisma.challenge.findMany).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(60_000);
      expect(prisma.challenge.findMany).toHaveBeenCalledTimes(2);

      service.onApplicationShutdown();
      await jest.advanceTimersByTimeAsync(120_000);
      expect(prisma.challenge.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
