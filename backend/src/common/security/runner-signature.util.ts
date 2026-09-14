import { createHmac, timingSafeEqual } from 'crypto';
import fs from 'fs';

export const RUNNER_SIGNATURE_HEADER = 'x-runner-signature';
export const RUNNER_TIMESTAMP_HEADER = 'x-runner-timestamp';
export const RUNNER_SIGNATURE_MAX_SKEW_MS = 60_000;

/**
 * RUNNER_SECRET, else the Docker secret file. Undefined when neither is
 * configured, in which case signatures are neither produced nor checked.
 */
export function loadRunnerSecret(): string | undefined {
  if (process.env.RUNNER_SECRET) return process.env.RUNNER_SECRET;
  try {
    return fs.readFileSync('/run/secrets/runner_secret', 'utf8').trim() || undefined;
  } catch {
    return undefined;
  }
}

/** HMAC-SHA256 over `${jobId}.${timestamp}.${body}` - the runner's format. */
export function signRunnerPayload(
  secret: string,
  jobId: string,
  timestamp: string,
  body: string,
): string {
  return createHmac('sha256', secret).update(`${jobId}.${timestamp}.${body}`).digest('hex');
}

export function verifyRunnerSignature(params: {
  secret: string;
  jobId: string;
  timestamp: string | undefined;
  signature: string | undefined;
  body: string;
  now?: number;
}): boolean {
  const { secret, jobId, timestamp, signature, body, now = Date.now() } = params;
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > RUNNER_SIGNATURE_MAX_SKEW_MS) return false;
  const expected = Buffer.from(signRunnerPayload(secret, jobId, timestamp, body), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
