import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import express from 'express';
import { createHmac } from 'crypto';

const redis = new Redis({ host: process.env.REDIS_HOST || 'redis' });
// BRPOPLPUSH blocks its connection until a job arrives; on the shared client
// it would hold back the heartbeat, so an idle worker would expire from
// runner:worker:* and look dead.
const queueRedis = redis.duplicate();
const baseDir = process.env.SHARED_WORKDIR || '/work_shared';
const workerId = process.env.WORKER_ID || uuidv4();
const HEARTBEAT_TTL = Number(process.env.WORKER_HEARTBEAT_TTL || 10);
/** Image every sandboxed job runs in. Pre-pulled at startup. */
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || 'node:22-alpine';
/** Label stamped on every job container so orphans can be swept on restart. */
const JOB_LABEL = 'codeclash.job=1';

// Queue entries are data from Redis, so they are validated before any of it
// reaches a docker argument: a job id is a UUID, a job directory is a single
// path segment created by the runner service's mkdtemp.
const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBDIR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

async function startHeartbeat() {
  try {
    await redis.set(`runner:worker:${workerId}`, String(Date.now()), 'EX', HEARTBEAT_TTL);
  } catch (e) {}
  setInterval(async () => {
    try { await redis.set(`runner:worker:${workerId}`, String(Date.now()), 'EX', HEARTBEAT_TTL); } catch (e) {}
  }, Math.max(2000, (HEARTBEAT_TTL - 2) * 1000));
}

async function ensureBase() {
  try { await fs.mkdir(baseDir, { recursive: true }); } catch (e) {}
}

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Upper bound on captured container output (the verdict is one JSON line). */
const MAX_CAPTURED_OUTPUT = 4 * 1024 * 1024;

/** Runs a docker CLI command to completion; resolves with its exit code. */
function docker(args: string[], opts: { quiet?: boolean } = {}): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn('docker', args, { env: process.env, stdio: opts.quiet ? 'ignore' : 'inherit' });
    p.on('error', () => resolve(-1));
    p.on('close', (code) => resolve(code ?? -1));
  });
}

async function removeContainer(name: string) {
  await docker(['rm', '-f', name], { quiet: true });
}

/** Removes job containers left behind by a previous crash or restart. */
async function sweepOrphanedContainers() {
  const ids = await new Promise<string[]>((resolve) => {
    const p = spawn('docker', ['ps', '-aq', '--filter', `label=${JOB_LABEL}`], { env: process.env });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d.toString(); });
    p.on('error', () => resolve([]));
    p.on('close', () => resolve(buf.split(/\s+/).filter(Boolean)));
  });
  if (ids.length) {
    // eslint-disable-next-line no-console
    console.log(`Worker: removing ${ids.length} orphaned job container(s)`);
    await docker(['rm', '-f', ...ids], { quiet: true });
  }
}

/**
 * Makes sure the sandbox image is present before the first job, so a cold
 * daemon does not spend a job's time budget pulling it.
 */
async function ensureSandboxImage(attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    if ((await docker(['image', 'inspect', SANDBOX_IMAGE], { quiet: true })) === 0) return;
    // eslint-disable-next-line no-console
    console.log(`Worker: pulling sandbox image ${SANDBOX_IMAGE} (attempt ${i}/${attempts})`);
    if ((await docker(['pull', SANDBOX_IMAGE])) === 0) return;
    await wait(3000 * i);
  }
  // eslint-disable-next-line no-console
  console.warn(`Worker: sandbox image ${SANDBOX_IMAGE} is unavailable; jobs will fail until it can be pulled`);
}

/**
 * Per-job container settings written by the runner service alongside job.json.
 * Absent for legacy /run jobs, which keep the previous fixed limits.
 */
interface RunnerManifest {
  entry: string;
  memoryLimitMb: number;
  hardTimeoutMs: number;
  protocol: string;
}

const DEFAULT_MANIFEST: RunnerManifest = {
  entry: 'executor.js',
  memoryLimitMb: 256,
  hardTimeoutMs: 60_000,
  protocol: 'v1',
};

async function readManifest(subdir: string): Promise<RunnerManifest> {
  try {
    const raw = await fs.readFile(path.join(baseDir, subdir, 'runner.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      // Only ever one of the two executors we ship - never an arbitrary path
      // from the queue payload.
      entry: parsed.entry === 'judge-runtime.js' ? 'judge-runtime.js' : 'executor.js',
      memoryLimitMb: Math.max(32, Math.min(Number(parsed.memoryLimitMb) || 256, 512)),
      hardTimeoutMs: Math.max(1000, Math.min(Number(parsed.hardTimeoutMs) || 60_000, 180_000)),
      protocol: String(parsed.protocol || 'v1'),
    };
  } catch (e) {
    return DEFAULT_MANIFEST;
  }
}

async function runJob(job: any) {
  const { jobId, subdir, metadata } = job;
  if (typeof jobId !== 'string' || !JOB_ID_PATTERN.test(jobId) ||
      typeof subdir !== 'string' || !SUBDIR_PATTERN.test(subdir)) {
    // eslint-disable-next-line no-console
    console.error('Worker: rejecting malformed job', JSON.stringify(job).slice(0, 300));
    return;
  }
  await ensureBase();
  const manifest = await readManifest(subdir);
  // eslint-disable-next-line no-console
  console.log(`Worker: running job ${jobId} (${manifest.protocol}) in subdir ${subdir}`);

  // The container - not the vm module inside it - is the security boundary:
  // no network, no capabilities, no privilege escalation, read-only rootfs,
  // non-root user, and hard pid/memory/cpu ceilings. No secrets are passed in.
  //
  // Only this job's own directory is mounted, as a bind mount. The path is
  // resolved by the Docker daemon that runs the container (the dind service
  // in docker-compose, or the host daemon in local development), which mounts
  // the shared work volume at the same SHARED_WORKDIR path as this worker.
  // Arguments go straight to the docker CLI - no shell is involved.
  const containerName = `codeclash-job-${jobId}`;
  const args = [
    'run', '--rm',
    '--name', containerName,
    '--label', JOB_LABEL,
    '--network', 'none',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--pids-limit', '64',
    '--read-only',
    '--tmpfs', '/tmp:rw,size=50m',
    '--user', '65534:65534',
    '--memory', `${manifest.memoryLimitMb}m`,
    '--memory-swap', `${manifest.memoryLimitMb}m`,
    '--cpus', '0.5',
    '--mount', `type=bind,source=${path.posix.join(baseDir, subdir)},target=/work,readonly`,
    '-w', '/work',
    SANDBOX_IMAGE,
    'node', `--max-old-space-size=${Math.max(16, manifest.memoryLimitMb - 32)}`, manifest.entry,
  ];

  return new Promise<void>((resolve) => {
    const proc = spawn('docker', args, { env: process.env });
    let out = '';
    let timedOut = false;
    let forceTimer: NodeJS.Timeout | undefined;
    const killTimer = setTimeout(() => {
      timedOut = true;
      // Killing the docker CLI does not stop the container, so remove the
      // container itself; `docker run` then exits on its own.
      void removeContainer(containerName);
      // Backstop for a CLI that does not exit (e.g. the timeout fired before
      // the container existed): kill it and retry the removal.
      forceTimer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (e) {}
        void removeContainer(containerName);
      }, 5000);
    }, manifest.hardTimeoutMs);

    const append = (d: Buffer) => {
      if (out.length < MAX_CAPTURED_OUTPUT) out += d.toString();
    };
    proc.stdout.on('data', append);
    proc.stderr.on('data', append);
    proc.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error(`Worker: could not start docker for job ${jobId}`, err);
    });
    proc.on('close', async (code) => {
      clearTimeout(killTimer);
      if (forceTimer) clearTimeout(forceTimer);
      // 137 is SIGKILL, which for these containers means the memory cgroup
      // limit was hit. The runtime is already gone, so the limit is reported
      // here instead of per test.
      const limitExceeded = timedOut ? 'TIME' : code === 137 ? 'MEMORY' : null;
      const payload = { jobId, output: out, exitCode: code, limitExceeded, metadata: metadata || null };
      try {
        await redis.lpush(`code_results:${jobId}`, JSON.stringify(payload));
        // index recent results for dashboard (include metadata)
        try {
          await redis.lpush('code_results_index', JSON.stringify({ jobId, timestamp: Date.now(), exitCode: code, metadata: metadata || null }));
          await redis.ltrim('code_results_index', 0, 499);
        } catch (e) {}
      } catch (e) {}
      // post to backend for persistence if BACKEND_URL is configured
      try {
        const backend = process.env.BACKEND_URL || 'http://backend:4000';
        const jobPostBody = { jobId, metadata: metadata || null, exitCode: code, payload };
        const bodyStr = JSON.stringify(jobPostBody);
        const headers: any = { 'Content-Type': 'application/json' };
        let secret = process.env.RUNNER_SECRET;
        if (!secret) {
          try {
            const s = await fs.readFile('/run/secrets/runner_secret', 'utf8');
            secret = s.trim();
          } catch (e) {
            // no file present
          }
        }
        const ts = String(Date.now());
        if (secret) {
          const sig = createHmac('sha256', secret).update(`${jobId}.${ts}.${bodyStr}`).digest('hex');
          headers['x-runner-timestamp'] = ts;
          headers['x-runner-signature'] = sig;
        }
        await fetch(`${backend}/api/jobs/record`, {
          method: 'POST',
          headers,
          body: bodyStr,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to POST job result to backend', e);
      }
      // cleanup: remove job dir from shared volume (best-effort)
      try { await fs.rm(path.join(baseDir, subdir), { recursive: true, force: true }); } catch (e) {}
      resolve();
    });
  });
}

async function loop() {
  // start health server
  const healthPort = Number(process.env.WORKER_PORT || 5001);
  const app = express();
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/ready', async (_req, res) => {
    // check docker and redis
    try {
      // docker info
      const code = await docker(['info'], { quiet: true });
      if (code !== 0) throw new Error('docker info exit ' + code);
      const r = await redis.ping();
      if (r === 'PONG') return res.json({ ready: true });
      return res.status(503).json({ ready: false, redis: r });
    } catch (e) {
      return res.status(503).json({ ready: false, error: String(e) });
    }
  });
  app.listen(healthPort, () => {
    // eslint-disable-next-line no-console
    console.log(`Worker health server listening on ${healthPort}`);
  });
  // cleanup on exit
  const shutdown = async () => {
    try { await redis.del(`runner:worker:${workerId}`); } catch (e) {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // wait for docker to be available (dind)
  async function waitForDocker(attempts = 60, delay = 1000) {
    for (let i = 0; i < attempts; i++) {
      try {
        const code = await docker(['info'], { quiet: true });
        if (code !== 0) throw new Error('docker info exit ' + code);
        return;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('docker not ready, waiting...', e);
        await wait(delay);
      }
    }
    // eslint-disable-next-line no-console
    console.warn('docker did not become ready after wait');
  }
  await waitForDocker();
  await sweepOrphanedContainers();
  await ensureSandboxImage();
  // Register only once jobs can actually run: the API treats a registered
  // worker as "ready" (e.g. before validating challenges at startup).
  startHeartbeat().catch((e) => console.error('heartbeat failed', e));
  while (true) {
    try {
      const jobRaw = await queueRedis.brpoplpush('code_jobs', 'code_jobs:processing', 0);
      if (!jobRaw) { await wait(100); continue; }
      let job;
      try { job = JSON.parse(jobRaw); } catch (e) { console.error('Failed to parse job JSON', jobRaw); await redis.lrem('code_jobs:processing', 0, jobRaw); continue; }
      await runJob(job);
      // remove from processing list
      await redis.lrem('code_jobs:processing', 0, jobRaw);
    } catch (e) {
      await wait(1000);
    }
  }
}

loop().catch(err => { console.error('worker loop failed', err); process.exit(1); });
