/**
 * For a read that is repeated - on load, on socket events, after reconnects -
 * and whose answers can arrive out of order: number each read with `next()`
 * and apply an answer only when `accept(id)` says no newer answer has been
 * applied yet. Otherwise a slow, older read could put back state that a
 * newer one already replaced (a match that has ended, say).
 */
export function requestOrder() {
  let sent = 0;
  let shown = 0;
  return {
    next: () => ++sent,
    /** True, and remembered, for an answer at least as new as every one accepted so far. */
    accept(id: number): boolean {
      if (id < shown) return false;
      shown = id;
      return true;
    },
  };
}
