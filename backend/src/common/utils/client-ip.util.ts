import type { Request } from 'express';

/**
 * Strips the IPv4-mapped IPv6 prefix (e.g. "::ffff:127.0.0.1" -> "127.0.0.1")
 * so downstream checks only need to reason about one address family at a time.
 */
export function normalizeIp(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(
    ip.trim(),
  );
  return mapped ? mapped[1] : ip.trim();
}

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./, // link-local
  /^127\./, // loopback
];

/**
 * True for loopback, link-local, and RFC1918/RFC4193 private ranges - these
 * cannot be geolocated meaningfully and must never be sent to an external provider.
 */
export function isLocalOrPrivateIp(ip: string): boolean {
  const normalized = normalizeIp(ip);

  if (!normalized || normalized === '::1' || normalized === 'localhost') {
    return true;
  }

  if (PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const lower = normalized.toLowerCase();
  if (lower.startsWith('fe80:')) return true; // IPv6 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // IPv6 unique local (fc00::/7)

  return false;
}

/**
 * Resolves the client's IP, preferring Express's `req.ip` (which honors the
 * `trust proxy` setting) and falling back to the raw socket address.
 */
export function getClientIp(req: Request): string | null {
  const ip = req.ip || req.socket?.remoteAddress;
  return ip ? normalizeIp(ip) : null;
}
