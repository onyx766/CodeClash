/**
 * True when a token was issued before the account's sessions were revoked.
 *
 * `iat` is in whole seconds, so the comparison is done in seconds too: a token
 * issued in the same second as the revocation survives. Without that, a user
 * who signs in immediately after an admin reset could have their brand-new
 * session rejected. A token with no `iat` at all is treated as ancient.
 */
export function isTokenRevoked(
  issuedAtSeconds: number | undefined,
  sessionsRevokedAt: Date | null | undefined,
): boolean {
  if (!sessionsRevokedAt) return false;
  const revokedAtSeconds = Math.floor(sessionsRevokedAt.getTime() / 1000);
  return (issuedAtSeconds ?? 0) < revokedAtSeconds;
}
