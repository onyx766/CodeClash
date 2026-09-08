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

/** Picks `count` random, non-repeating items from `items` (id-deduplicated). */
export function pickRandom<T extends { id: string }>(items: T[], count: number): T[] {
  const used = new Set<string>();
  const picks: T[] = [];
  while (picks.length < count && used.size < items.length) {
    const candidate = items[Math.floor(Math.random() * items.length)];
    if (!used.has(candidate.id)) {
      used.add(candidate.id);
      picks.push(candidate);
    }
  }
  return picks;
}
