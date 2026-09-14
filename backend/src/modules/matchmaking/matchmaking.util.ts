import { MatchmakingConfig } from './matchmaking.constants';

/**
 * Rating tolerance (+/-) for a candidate opponent, widening the longer a
 * player has waited. See MatchmakingConfig for the thresholds/values.
 */
export function getRatingTolerance(
  waitSeconds: number,
  config: Pick<
    MatchmakingConfig,
    'rangeInitial' | 'range10s' | 'range20s' | 'range30s' | 'rangeMax'
  >,
): number {
  if (waitSeconds < 10) return config.rangeInitial;
  if (waitSeconds < 20) return config.range10s;
  if (waitSeconds < 30) return config.range20s;
  if (waitSeconds < 45) return config.range30s;
  return config.rangeMax;
}
