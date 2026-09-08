import { ConfigService } from '@nestjs/config';

export const MATCHMAKING_RATING_ZSET = 'matchmaking:quick:rating';
export const MATCHMAKING_JOINED_ZSET = 'matchmaking:quick:joined';

export function reservationKey(userId: string): string {
  return `matchmaking:quick:reservation:${userId}`;
}

export function lastSeenKey(userId: string): string {
  return `matchmaking:quick:lastseen:${userId}`;
}

/** Order-independent so either user can be "A" - always the same key for a pair. */
export function recentPairKey(userAId: string, userBId: string): string {
  const [a, b] = [userAId, userBId].sort();
  return `matchmaking:recent-pair:${a}:${b}`;
}

export interface MatchmakingConfig {
  rangeInitial: number;
  range10s: number;
  range20s: number;
  range30s: number;
  rangeMax: number;
  tickMs: number;
  maxPerTick: number;
  reservationTtlSeconds: number;
  staleTimeoutMs: number;
  recentOpponentTtlSeconds: number;
  readyTimeoutSeconds: number;
}

export function loadMatchmakingConfig(config: ConfigService): MatchmakingConfig {
  return {
    rangeInitial: config.get<number>('MATCHMAKING_RANGE_INITIAL') ?? 100,
    range10s: config.get<number>('MATCHMAKING_RANGE_10S') ?? 150,
    range20s: config.get<number>('MATCHMAKING_RANGE_20S') ?? 250,
    range30s: config.get<number>('MATCHMAKING_RANGE_30S') ?? 400,
    rangeMax: config.get<number>('MATCHMAKING_RANGE_MAX') ?? 600,
    tickMs: config.get<number>('MATCHMAKING_TICK_MS') ?? 1000,
    maxPerTick: config.get<number>('MATCHMAKING_MAX_PER_TICK') ?? 50,
    reservationTtlSeconds:
      config.get<number>('MATCHMAKING_RESERVATION_TTL_SECONDS') ?? 20,
    staleTimeoutMs: config.get<number>('MATCHMAKING_STALE_TIMEOUT_MS') ?? 10_000,
    recentOpponentTtlSeconds:
      config.get<number>('MATCHMAKING_RECENT_OPPONENT_TTL_SECONDS') ?? 1800,
    readyTimeoutSeconds: config.get<number>('MATCH_READY_TIMEOUT_SECONDS') ?? 10,
  };
}
