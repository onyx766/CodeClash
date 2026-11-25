/**
 * Every room today is created by a host and joined by code - i.e. a private
 * room. This metadata is presentation-only (not persisted) and always says
 * casual/not-rating-eligible, independent of whatever the Match/RatingService
 * layers separately enforce - see the anti-rigging plan.
 *
 * Shared by the HTTP room endpoints and the room:update socket snapshots so
 * clients get the same shape from both.
 */
export function withCasualMetadata<T>(room: T) {
  return {
    ...room,
    type: 'PRIVATE_ROOM' as const,
    mode: 'CASUAL' as const,
    ratingEligible: false,
    ratingMessage: 'Private room matches do not affect rating.',
  };
}
