import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  RunnerJobPayload,
  RunnerJobResult,
} from '../challenges/challenge.types';

/**
 * The single door between NestJS and the isolated code runner.
 *
 * Everything executable - player submissions, reference solutions, custom
 * checkers, test generators - leaves this process as a string in a JSON body
 * and is executed only inside the runner's container. Nothing here evals,
 * compiles or requires any of it, and the browser never talks to the runner
 * directly: it is always browser -> NestJS -> runner -> NestJS.
 */
@Injectable()
export class JudgeRunnerClient {
  private readonly logger = new Logger(JudgeRunnerClient.name);

  constructor(private readonly config: ConfigService) {}

  private get runnerUrl(): string {
    return (
      this.config.get<string>('CODE_RUNNER_URL') || 'http://localhost:5000'
    );
  }

  /**
   * Wall-clock budget for the HTTP call itself. Generous relative to the job's
   * own limits because the runner queues the job, waits for a worker to pick a
   * container up, and only then starts executing.
   */
  private timeoutFor(payload: RunnerJobPayload): number {
    const perTest = payload.limits.timeLimitMs;
    const testCount = Math.max(
      1,
      payload.tests.length + (payload.generatorSeeds?.length ?? 0),
    );
    const multiplier = payload.jobType === 'CHALLENGE_VALIDATION' ? 4 : 2;
    return Math.min(180_000, 30_000 + perTest * testCount * multiplier);
  }

  async submit(payload: RunnerJobPayload): Promise<RunnerJobResult> {
    const response = await axios.post<RunnerJobResult>(
      `${this.runnerUrl}/v2/judge`,
      payload,
      { timeout: this.timeoutFor(payload) },
    );
    return response.data;
  }

  /**
   * Same call, but network/runner failures come back as a result object rather
   * than an exception, so a caller can turn "the runner is down" into a
   * validation failure instead of a 500.
   */
  async trySubmit(
    payload: RunnerJobPayload,
  ): Promise<RunnerJobResult | { ok: false; error: string }> {
    try {
      return await this.submit(payload);
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data
          ? JSON.stringify(error.response.data).slice(0, 500)
          : error instanceof Error
            ? error.message
            : String(error);
      this.logger.warn(
        `Runner job ${payload.jobType} for challenge ${payload.challengeId} failed: ${message}`,
      );
      return { ok: false, error: message };
    }
  }
}
