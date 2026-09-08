import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MatchmakingService } from './matchmaking.service';
import { loadMatchmakingConfig } from './matchmaking.constants';

const INTERVAL_NAME = 'matchmaking-tick';

/**
 * Background pairing loop (spec section 15). Uses SchedulerRegistry rather
 * than the `@Interval` decorator so the tick cadence can come from
 * MATCHMAKING_TICK_MS instead of being hardcoded at decoration time.
 *
 * Safe to run on every backend instance simultaneously: nothing here is a
 * mutex, all correctness comes from the atomic Redis claim (pairing) and the
 * conditional Postgres update (ready timeouts) - see MatchmakingService.
 */
@Injectable()
export class MatchmakingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchmakingWorker.name);
  private readonly tickMs: number;
  private running = false;

  constructor(
    private readonly matchmaking: MatchmakingService,
    private readonly schedulerRegistry: SchedulerRegistry,
    config: ConfigService,
  ) {
    this.tickMs = loadMatchmakingConfig(config).tickMs;
  }

  onModuleInit(): void {
    const interval = setInterval(() => {
      void this.tick();
    }, this.tickMs);
    this.schedulerRegistry.addInterval(INTERVAL_NAME, interval);
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(INTERVAL_NAME);
    }
  }

  private async tick(): Promise<void> {
    // Skip if the previous tick is still running (e.g. a slow DB) rather
    // than overlapping ticks on the same instance.
    if (this.running) return;
    this.running = true;
    try {
      await this.matchmaking.processReadyTimeouts();
      await this.matchmaking.sweepStaleQueueEntries();
      await this.matchmaking.processPairingBatch();
    } catch (err) {
      this.logger.error('Matchmaking tick failed', err instanceof Error ? err.stack : err);
    } finally {
      this.running = false;
    }
  }
}
