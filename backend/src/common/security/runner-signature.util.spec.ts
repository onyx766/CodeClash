import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { JudgeRunnerClient } from '../../modules/runner/judge-runner.client';
import type { RunnerJobPayload } from '../../modules/challenges/challenge.types';
import { signRunnerPayload, verifyRunnerSignature } from './runner-signature.util';

const SECRET = 'test-runner-secret';
const BODY = JSON.stringify({ jobId: 'job-1', ok: true, passedTests: 3, totalTests: 3 });

describe('verifyRunnerSignature', () => {
  const now = 1_800_000_000_000;
  const ts = String(now);
  const signature = signRunnerPayload(SECRET, 'job-1', ts, BODY);

  it('accepts a signature over the exact body', () => {
    expect(verifyRunnerSignature({ secret: SECRET, jobId: 'job-1', timestamp: ts, signature, body: BODY, now })).toBe(true);
  });

  it('rejects a tampered body, another job id or another secret', () => {
    const tampered = BODY.replace('"passedTests":3', '"passedTests":4');
    expect(verifyRunnerSignature({ secret: SECRET, jobId: 'job-1', timestamp: ts, signature, body: tampered, now })).toBe(false);
    expect(verifyRunnerSignature({ secret: SECRET, jobId: 'job-2', timestamp: ts, signature, body: BODY, now })).toBe(false);
    expect(verifyRunnerSignature({ secret: 'other', jobId: 'job-1', timestamp: ts, signature, body: BODY, now })).toBe(false);
  });

  it('rejects stale, missing or malformed signatures', () => {
    expect(
      verifyRunnerSignature({ secret: SECRET, jobId: 'job-1', timestamp: ts, signature, body: BODY, now: now + 61_000 }),
    ).toBe(false);
    expect(verifyRunnerSignature({ secret: SECRET, jobId: 'job-1', timestamp: undefined, signature, body: BODY, now })).toBe(false);
    expect(verifyRunnerSignature({ secret: SECRET, jobId: 'job-1', timestamp: ts, signature: 'abc', body: BODY, now })).toBe(false);
  });
});

describe('JudgeRunnerClient signature check', () => {
  const payload = { jobType: 'SUBMISSION', challengeId: 'c', limits: { timeLimitMs: 1000 }, tests: [] } as unknown as RunnerJobPayload;
  const config = { get: jest.fn() } as unknown as ConfigService;
  let post: jest.SpyInstance;

  beforeEach(() => {
    post = jest.spyOn(axios, 'post');
  });

  afterEach(() => {
    post.mockRestore();
    delete process.env.RUNNER_SECRET;
  });

  function respond(headers: Record<string, string>, body = BODY) {
    post.mockResolvedValue({ data: body, headers });
  }

  it('accepts a correctly signed verdict', async () => {
    process.env.RUNNER_SECRET = SECRET;
    const ts = String(Date.now());
    respond({ 'x-runner-timestamp': ts, 'x-runner-signature': signRunnerPayload(SECRET, 'job-1', ts, BODY) });

    await expect(new JudgeRunnerClient(config).submit(payload)).resolves.toMatchObject({ jobId: 'job-1', passedTests: 3 });
  });

  it('rejects an unsigned or forged verdict when a secret is configured', async () => {
    process.env.RUNNER_SECRET = SECRET;
    const client = new JudgeRunnerClient(config);

    respond({});
    await expect(client.submit(payload)).rejects.toThrow(/signature/);

    const ts = String(Date.now());
    const forged = BODY.replace('"passedTests":3', '"passedTests":4');
    respond({ 'x-runner-timestamp': ts, 'x-runner-signature': signRunnerPayload(SECRET, 'job-1', ts, BODY) }, forged);
    await expect(client.submit(payload)).rejects.toThrow(/signature/);
  });

  it('does not require a signature when no secret is configured', async () => {
    respond({});
    await expect(new JudgeRunnerClient(config).submit(payload)).resolves.toMatchObject({ jobId: 'job-1' });
  });
});
