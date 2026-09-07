export const DEFAULT_K_FACTOR = 32;

/**
 * Standard logistic expected-score formula: the probability `ratingA` is
 * expected to beat `ratingB`, in [0, 1].
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Rating points the winner gains (the loser loses the same amount - MVP uses
 * a zero-sum model with a single shared K-factor).
 */
export function calculateEloChange(
  winnerRating: number,
  loserRating: number,
  kFactor = DEFAULT_K_FACTOR,
): number {
  const expected = expectedScore(winnerRating, loserRating);
  return Math.round(kFactor * (1 - expected));
}
