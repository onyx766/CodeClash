import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MatchmakingWorker } from './matchmaking.worker';
import { MatchmakingService } from './matchmaking.service';

describe('MatchmakingWorker', () => {
  let matchmaking: {
    processReadyTimeouts: jest.Mock;
    sweepStaleQueueEntries: jest.Mock;
    processPairingBatch: jest.Mock;
  };
  let schedulerRegistry: { addInterval: jest.Mock; deleteInterval: jest.Mock; doesExist: jest.Mock };
  let worker: MatchmakingWorker;
  const callOrder: string[] = [];

  beforeEach(async () => {
    jest.useFakeTimers();
    callOrder.length = 0;
    matchmaking = {
      processReadyTimeouts: jest.fn().mockImplementation(async () => {
        callOrder.push('readyTimeouts');
      }),
      sweepStaleQueueEntries: jest.fn().mockImplementation(async () => {
        callOrder.push('stale');
      }),
      processPairingBatch: jest.fn().mockImplementation(async () => {
        callOrder.push('pairing');
      }),
    };
    schedulerRegistry = {
      addInterval: jest.fn(),
      deleteInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
    };
    const config = { get: jest.fn().mockReturnValue(undefined) }; // defaults: tickMs=1000

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingWorker,
        { provide: MatchmakingService, useValue: matchmaking },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    worker = module.get(MatchmakingWorker);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers a named interval with the scheduler on init', () => {
    worker.onModuleInit();
    expect(schedulerRegistry.addInterval).toHaveBeenCalledWith('matchmaking-tick', expect.anything());
  });

  it('runs ready-timeout sweep, then stale sweep, then pairing, in that order every tick', async () => {
    worker.onModuleInit();
    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(callOrder).toEqual(['readyTimeouts', 'stale', 'pairing']);
  });

  it('does not overlap ticks - a slow tick blocks the next one until it finishes', async () => {
    let resolvePairing: () => void = () => undefined;
    matchmaking.processPairingBatch.mockImplementation(
      () => new Promise<void>((resolve) => { resolvePairing = resolve; }),
    );

    worker.onModuleInit();
    jest.advanceTimersByTime(1000); // tick 1 starts, hangs in processPairingBatch
    await flushMicrotasks();
    jest.advanceTimersByTime(1000); // tick 2 fires while tick 1 is still running
    await flushMicrotasks();

    expect(matchmaking.processReadyTimeouts).toHaveBeenCalledTimes(1); // not re-entered

    resolvePairing();
    await flushMicrotasks();
    jest.advanceTimersByTime(1000); // tick 3, now that tick 1 finished
    await flushMicrotasks();

    expect(matchmaking.processReadyTimeouts).toHaveBeenCalledTimes(2);
  });

  it('removes the interval on destroy', () => {
    worker.onModuleInit();
    worker.onModuleDestroy();
    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith('matchmaking-tick');
  });

  it('logs and continues instead of throwing when a tick step fails', async () => {
    matchmaking.processReadyTimeouts.mockRejectedValueOnce(new Error('boom'));
    worker.onModuleInit();

    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    // Should not have thrown out of the interval callback, and should try
    // again on the next tick.
    jest.advanceTimersByTime(1000);
    await flushMicrotasks();
    expect(matchmaking.processReadyTimeouts).toHaveBeenCalledTimes(2);
  });
});

async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}
