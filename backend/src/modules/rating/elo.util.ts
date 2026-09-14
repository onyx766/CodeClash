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

/**
 * Rating points player A gains from a draw (negative when A was the
 * favourite); player B moves by the opposite amount. Equal ratings -> 0.
 */
export function calculateEloDrawChange(
  ratingA: number,
  ratingB: number,
  kFactor = DEFAULT_K_FACTOR,
): number {
  const change = Math.round(kFactor * (0.5 - expectedScore(ratingA, ratingB)));
  return change === 0 ? 0 : change;
}
