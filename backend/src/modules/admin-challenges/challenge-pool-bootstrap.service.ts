import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChallengeStatus, ChallengeValidationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ChallengeValidationFailedException } from '../../common/exceptions/app.exception';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import { ChallengeValidationService } from './challenge-validation.service';

/** First attempt shortly after boot; the runner usually starts alongside us. */
export const BOOTSTRAP_INITIAL_DELAY_MS = 5_000;
/** Retry backoff ceiling while the runner is not ready yet. */
export const BOOTSTRAP_MAX_DELAY_MS = 5 * 60_000;
/** Challenges validated per pass; each is a full sandbox job. */
const BATCH_LIMIT = 100;

const LOCK_KEY = 'challenge-pool:auto-validation:lock';
const LOCK_TTL_SECONDS = 15 * 60;

export type BootstrapPassResult =
  | { state: 'idle' }
  | { state: 'locked' }
  | { state: 'runner-unavailable'; reason: string }
  | { state: 'done'; passed: number; failed: number; errors: number };

/**
 * Validates published challenges that have never been checked, in the
 * background, as soon as a code-runner worker is available.
 *
 * Battles only draw from challenges whose validation PASSED (see
 * MATCH_REQUIRE_VALIDATED_CHALLENGES), and validation is a real sandbox run
 * of the reference solution against every test case. Seeded and imported
 * challenges start out NOT_CHECKED, so without this a fresh installation
 * could not start a single match until an admin validated each challenge by
 * hand. Nothing is marked as passed without actually running it.
 *
 * Only NOT_CHECKED challenges are picked up: one that FAILED stays failed
 * until an admin fixes and re-validates it. If the runner is unreachable the
 * pass stops without recording anything and is retried with backoff. A Redis
 * lock keeps several API instances from validating the same set at once.
 *
 * Controlled by AUTO_VALIDATE_CHALLENGES (default true); never runs under
 * NODE_ENV=test.
 */
@Injectable()
export class ChallengePoolBootstrapService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ChallengePoolBootstrapService.name);
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly runner: JudgeRunnerClient,
    private readonly validation: ChallengeValidationService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.isEnabled()) return;
    // Fire-and-forget: startup never waits on the runner.
    this.schedule(BOOTSTRAP_INITIAL_DELAY_MS, 0);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  isEnabled(): boolean {
    if (this.config.get<string>('NODE_ENV') === 'test') return false;
    const flag = this.config.get<string | boolean>('AUTO_VALIDATE_CHALLENGES');
    return !(flag === false || flag === 'false');
  }

  /** Exponential backoff for retry `attempt` (0-based), capped. */
  static retryDelay(attempt: number): number {
    return Math.min(BOOTSTRAP_MAX_DELAY_MS, 10_000 * 2 ** Math.max(0, attempt));
  }

  private schedule(delayMs: number, attempt: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.tick(attempt);
    }, delayMs);
    this.timer.unref?.();
  }

  private async tick(attempt: number): Promise<void> {
    let result: BootstrapPassResult;
    try {
      result = await this.runPass();
    } catch (error) {
      this.logger.error(
        'Automatic challenge validation pass failed',
        error instanceof Error ? error.stack : String(error),
      );
      result = { state: 'runner-unavailable', reason: 'unexpected error' };
    }

    if (result.state === 'runner-unavailable' || result.state === 'locked') {
      const delay = ChallengePoolBootstrapService.retryDelay(attempt);
      if (result.state === 'runner-unavailable') {
        this.logger.log(
          `Code runner not ready (${result.reason}); retrying challenge validation in ${Math.round(delay / 1000)}s.`,
        );
      }
      this.schedule(delay, attempt + 1);
      return;
    }
    if (result.state === 'done' && result.errors > 0) {
      // Something other than runner availability went wrong for a few;
      // give them another chance later without hammering.
      this.schedule(BOOTSTRAP_MAX_DELAY_MS, attempt + 1);
    }
  }

  /** One validation pass. Public for tests and manual triggering. */
  async runPass(): Promise<BootstrapPassResult> {
    const targets = await this.prisma.challenge.findMany({
      where: {
        status: ChallengeStatus.PUBLISHED,
        archivedAt: null,
        validationStatus: ChallengeValidationStatus.NOT_CHECKED,
      },
      select: { id: true, title: true },
      orderBy: { createdAt: 'asc' },
      take: BATCH_LIMIT,
    });
    if (targets.length === 0) return { state: 'idle' };

    const readiness = await this.runnerReadiness();
    if (!readiness.ready) return { state: 'runner-unavailable', reason: readiness.reason };

    const client = this.redis.getClient();
    const acquired = await client.set(LOCK_KEY, String(process.pid), 'EX', LOCK_TTL_SECONDS, 'NX');
    if (acquired !== 'OK') return { state: 'locked' };

    let passed = 0;
    let failed = 0;
    let errors = 0;
    try {
      this.logger.log(`Validating ${targets.length} unchecked published challenge(s) in the sandbox.`);
      for (const target of targets) {
        if (this.stopped) break;
        try {
          const { validation } = await this.validation.validate(target.id);
          if (validation.status === ChallengeValidationStatus.PASSED) passed++;
          else {
            failed++;
            this.logger.warn(`Challenge "${target.title}" failed validation; it stays out of the battle pool.`);
          }
        } catch (error) {
          if (error instanceof ChallengeValidationFailedException) {
            // The runner went away mid-pass. Nothing was recorded for this
            // challenge, so the next pass picks it up again.
            return { state: 'runner-unavailable', reason: error.message };
          }
          errors++;
          this.logger.error(
            `Validating challenge ${target.id} failed`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } finally {
      await client.del(LOCK_KEY).catch(() => undefined);
    }

    this.logger.log(
      `Automatic challenge validation finished: ${passed} passed, ${failed} failed, ${errors} errored.`,
    );
    return { state: 'done', passed, failed, errors };
  }

  /**
   * The runner HTTP service must answer, and at least one queue worker must
   * have registered (workers only register once they can execute jobs), or a
   * validation job would just sit in the queue until it times out.
   */
  private async runnerReadiness(): Promise<{ ready: boolean; reason: string }> {
    const probe = await this.runner.probe();
    if (!probe.reachable) return { ready: false, reason: 'runner service unreachable' };
    try {
      const workers = await this.redis.getClient().keys('runner:worker:*');
      if (workers.length === 0) return { ready: false, reason: 'no runner worker registered yet' };
    } catch {
      return { ready: false, reason: 'redis unavailable' };
    }
    return { ready: true, reason: '' };
  }
}
