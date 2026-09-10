import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import express from 'express';
import { createHmac } from 'crypto';

const redis = new Redis({ host: process.env.REDIS_HOST || 'redis' });
const baseDir = process.env.SHARED_WORKDIR || '/work_shared';
const workerId = process.env.WORKER_ID || uuidv4();
const HEARTBEAT_TTL = Number(process.env.WORKER_HEARTBEAT_TTL || 10);

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
  await ensureBase();
  const manifest = await readManifest(subdir);
  // eslint-disable-next-line no-console
  console.log(`Worker: running job ${jobId} (${manifest.protocol}) in subdir ${subdir}`);

  // The container - not the vm module inside it - is the security boundary:
  // no network, no capabilities, no privilege escalation, read-only rootfs,
  // non-root user, and hard pid/memory/cpu ceilings. No secrets are passed in:
  // the environment is whatever node:18-alpine ships with.
  const cmd = `docker run --rm -i \
    --network none \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --pids-limit=64 \
    --read-only \
    --tmpfs /tmp:rw,size=50m \
    --user 65534 \
    --memory ${manifest.memoryLimitMb}m \
    --memory-swap ${manifest.memoryLimitMb}m \
    --cpus .5 \
    --mount source=runner-work,target=/work,readonly \
    -w /work/${subdir} \
    node:18-alpine node --max-old-space-size=${Math.max(16, manifest.memoryLimitMb - 32)} ${manifest.entry}`;

  return new Promise<void>((resolve) => {
    const proc = spawn('sh', ['-c', cmd], { env: process.env });
    let out = '';
    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGKILL'); } catch (e) {}
    }, manifest.hardTimeoutMs);

    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('close', async (code) => {
      clearTimeout(killTimer);
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
        const backend = process.env.BACKEND_URL || 'http://backend:3001';
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
      await new Promise<void>((resolve, reject) => {
        const p = spawn('sh', ['-c', 'docker info'], { env: process.env });
        p.on('close', (code) => { if (code === 0) resolve(); else reject(new Error('docker info exit '+code)); });
      });
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
  // start heartbeat registration
  startHeartbeat().catch((e) => console.error('heartbeat failed', e));

  // cleanup on exit
  process.on('SIGINT', async () => {
    try { await redis.del(`runner:worker:${workerId}`); } catch (e) {}
    process.exit(0);
  });
  // wait for docker to be available (dind)
  async function waitForDocker(attempts = 10, delay = 1000) {
    for (let i = 0; i < attempts; i++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const p = spawn('sh', ['-c', 'docker info'], { env: process.env });
          p.on('close', (code) => { if (code === 0) resolve(); else reject(new Error('docker info exit '+code)); });
        });
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
  while (true) {
    try {
      const jobRaw = await redis.brpoplpush('code_jobs', 'code_jobs:processing', 0);
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
