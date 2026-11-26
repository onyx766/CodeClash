import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { createHmac } from 'crypto';

const execAsync = util.promisify(exec);
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT) || 6379,
});

/**
 * Waits for a job's result on a dedicated connection. BRPOP blocks the
 * connection it runs on, so issuing it on the shared client would stall every
 * other command (other requests' enqueues, /ready's PING) until this job
 * finished.
 */
async function waitForResult(jobId: string, timeoutSeconds: number): Promise<[string, string] | null> {
  const waiter = redis.duplicate();
  try {
    return (await waiter.brpop(`code_results:${jobId}`, timeoutSeconds)) as [string, string] | null;
  } finally {
    waiter.disconnect();
  }
}

/** Same secret and sources as the worker's /jobs/record signature. */
function loadRunnerSecret(): string | undefined {
  if (process.env.RUNNER_SECRET) return process.env.RUNNER_SECRET;
  try {
    return fsSync.readFileSync('/run/secrets/runner_secret', 'utf8').trim() || undefined;
  } catch (e) {
    return undefined;
  }
}
const RUNNER_SECRET = loadRunnerSecret();

/**
 * Sends a judge verdict with an HMAC-SHA256 signature over
 * `${jobId}.${timestamp}.${body}` so the backend can reject a verdict that did
 * not come from this runner. Unsigned when no secret is configured.
 */
function sendSigned(res: express.Response, status: number, body: any) {
  const bodyStr = JSON.stringify(body);
  if (RUNNER_SECRET) {
    const ts = String(Date.now());
    const sig = createHmac('sha256', RUNNER_SECRET)
      .update(`${body?.jobId ?? ''}.${ts}.${bodyStr}`)
      .digest('hex');
    res.setHeader('x-runner-timestamp', ts);
    res.setHeader('x-runner-signature', sig);
  }
  res.status(status).type('application/json').send(bodyStr);
}

async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // eslint-disable-next-line no-console
      console.warn(`Retry ${i + 1}/${attempts} failed: ${String(e)}`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

const app = express();
// A judge payload carries up to 200 test cases of up to 64 KB of input and
// 64 KB of expected output each (see backend challenge.constants.ts).
app.use(bodyParser.json({ limit: process.env.RUNNER_BODY_LIMIT || '32mb' }));

// Health endpoint
app.get('/health', (_req, res) => res.json({ ok: true }));

// Readiness: check Redis
app.get('/ready', async (_req, res) => {
  try {
    const p = await redis.ping();
    if (p === 'PONG') return res.json({ ready: true });
    return res.status(503).json({ ready: false, redis: p });
  } catch (e) {
    return res.status(503).json({ ready: false, error: String(e) });
  }
});

/**
 * Absolute path to an executor script that gets copied into a job directory.
 * Resolved at call time so it works both under ts-node (src/) and from a
 * compiled dist/ build.
 */
function resolveExecutor(fileName: string): string {
  const candidates = [
    path.join(__dirname, 'executor', fileName),
    path.join(__dirname, '..', 'src', 'executor', fileName),
    path.join(process.cwd(), 'src', 'executor', fileName),
  ];
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) return candidate;
  }
  throw new Error(`${fileName} could not be located`);
}

/** Pulls the last JSON object printed on stdout, ignoring any stderr noise. */
function extractJson(output: string): any | null {
  const lines = String(output || '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) continue;
    try {
      return JSON.parse(line);
    } catch (e) {
      // keep scanning older lines
    }
  }
  return null;
}

/**
 * Protocol v2. Accepts a structured CHALLENGE_VALIDATION or SUBMISSION job,
 * hands it to a sandboxed container via the worker queue, and returns the
 * runtime's structured verdict.
 *
 * Everything executable in the payload (player code, reference solution,
 * custom checker, generator) is written to disk as data and only ever run
 * inside that container.
 */
app.post('/v2/judge', async (req, res) => {
  const job = req.body || {};
  if (job.jobType !== 'CHALLENGE_VALIDATION' && job.jobType !== 'SUBMISSION') {
    return sendSigned(res, 400, { ok: false, error: 'Unknown jobType' });
  }
  if (!job.functionContract || !Array.isArray(job.tests)) {
    return sendSigned(res, 400, { ok: false, error: 'Invalid payload' });
  }
  if (job.jobType === 'SUBMISSION' && typeof job.sourceCode !== 'string') {
    return sendSigned(res, 400, { ok: false, error: 'SUBMISSION requires sourceCode' });
  }

  const baseDir = process.env.SHARED_WORKDIR || '/work_shared';
  try { await fs.mkdir(baseDir, { recursive: true }); } catch (e) {}
  const tmp = await fs.mkdtemp(path.join(baseDir, 'judge-'));
  // mkdtemp creates the directory 0700; the sandbox reads it as an
  // unprivileged uid, so it must be world-readable (it holds no secrets that
  // the job itself is not given anyway).
  await fs.chmod(tmp, 0o755);
  const jobId = uuidv4();

  const limits = job.limits || {};
  const timeLimitMs = Math.max(100, Math.min(Number(limits.timeLimitMs) || 2000, 10000));
  const memoryLimitMb = Math.max(32, Math.min(Number(limits.memoryLimitMb) || 128, 512));

  // Wall-clock ceiling for the whole container: every test may burn its full
  // time limit, plus room for module loading and (during validation) the
  // reference solution, checker and generator passes.
  const testCount = Math.max(1, job.tests.length + (job.generatorSeeds?.length || 0));
  const hardTimeoutMs = Math.min(
    120_000,
    10_000 + timeLimitMs * testCount * (job.jobType === 'CHALLENGE_VALIDATION' ? 4 : 2),
  );

  try {
    await fs.writeFile(
      path.join(tmp, 'job.json'),
      JSON.stringify({ ...job, jobId, limits: { ...limits, timeLimitMs, memoryLimitMb } }),
      'utf8',
    );
    await fs.writeFile(
      path.join(tmp, 'runner.json'),
      JSON.stringify({ entry: 'judge-runtime.js', memoryLimitMb, hardTimeoutMs, protocol: 'v2' }),
      'utf8',
    );
    await fs.copyFile(resolveExecutor('judge-runtime.js'), path.join(tmp, 'judge-runtime.js'));

    const subdir = path.basename(tmp);
    const queued = {
      jobId,
      subdir,
      createdAt: new Date().toISOString(),
      metadata: job.metadata || null,
    };

    try {
      await retry(() => redis.lpush('code_jobs', JSON.stringify(queued)), 3, 300);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to enqueue judge job', e);
      return sendSigned(res, 500, { ok: false, jobId, error: 'failed to enqueue job' });
    }

    const waitSeconds = Math.ceil(hardTimeoutMs / 1000) + 15;
    let popped: [string, string] | null = null;
    try {
      popped = await waitForResult(jobId, waitSeconds);
    } catch (e) {
      return sendSigned(res, 504, { ok: false, jobId, error: 'error waiting for runner' });
    }
    if (!popped || !popped[1]) {
      return sendSigned(res, 504, { ok: false, jobId, error: 'timeout waiting for runner' });
    }

    let envelope: any;
    try { envelope = JSON.parse(popped[1]); } catch (e) { envelope = { output: popped[1] }; }

    // The worker maps a container OOM kill / hard timeout onto these, because
    // the runtime itself is gone by the time either happens.
    if (envelope.limitExceeded === 'MEMORY') {
      return sendSigned(res, 200, memoryOrTimeVerdict(jobId, job, 'MEMORY_LIMIT', 'Memory limit exceeded.'));
    }
    if (envelope.limitExceeded === 'TIME') {
      return sendSigned(res, 200, memoryOrTimeVerdict(jobId, job, 'TIME_LIMIT', 'Execution timed out.'));
    }

    const parsed = extractJson(envelope.output);
    if (!parsed) {
      return sendSigned(res, 502, {
        ok: false,
        jobId,
        jobType: job.jobType,
        error: 'Runner produced no parseable result.',
        details: String(envelope.output || '').slice(0, 2000),
      });
    }

    return sendSigned(res, 200, { ...parsed, jobId });
  } catch (err: any) {
    return sendSigned(res, 500, { ok: false, jobId, error: String(err) });
  }
});

/**
 * A container-level kill leaves no per-test detail, so every test in the job is
 * reported with the limit that was hit.
 */
function memoryOrTimeVerdict(jobId: string, job: any, status: string, message: string) {
  const tests = (job.tests || []).map((t: any) => ({
    testId: t.id,
    hidden: !!t.hidden,
    order: t.order,
    status,
    runtimeMs: 0,
    message: t.hidden ? null : message,
  }));
  if (job.jobType === 'CHALLENGE_VALIDATION') {
    return {
      jobId,
      jobType: job.jobType,
      ok: true,
      checks: [
        { name: 'PUBLIC_TESTS', passed: false, message },
        { name: 'HIDDEN_TESTS', passed: false, message },
      ],
    };
  }
  return {
    jobId,
    jobType: job.jobType,
    ok: true,
    tests,
    passedTests: 0,
    totalTests: tests.length,
    runtimeMs: 0,
  };
}

/**
 * Malformed or oversized request bodies are rejected by body-parser before any
 * route runs; answer with the same signed JSON envelope as every verdict so
 * the API reports the real reason instead of failing to parse an HTML page.
 */
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!err) return next();
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  const error = err.type === 'entity.too.large' ? 'Judge payload is too large.' : 'Invalid judge request body.';
  return sendSigned(res, status, { ok: false, error });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Code runner listening on ${port}`);
});
