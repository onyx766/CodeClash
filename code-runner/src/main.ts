import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const execAsync = util.promisify(exec);
const redis = new Redis({ host: process.env.REDIS_HOST || 'redis' });

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
app.use(bodyParser.json());

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

async function writeExecutor(dir: string) {
  const executor = `const fs = require('fs');
const vm = require('vm');
function safeParse(s){ try{ return JSON.parse(s); }catch(e){ return eval(s);} }
const code = fs.readFileSync('./code.js', 'utf8');
const tests = JSON.parse(fs.readFileSync('./tests.json','utf8'));
const functionName = fs.existsSync('./functionName.txt') ? fs.readFileSync('./functionName.txt','utf8').trim() : null;
const timeLimit = fs.existsSync('./timeLimit.txt') ? parseInt(fs.readFileSync('./timeLimit.txt','utf8')) : 5;
const results = [];
let passed = 0;
const context = { module: { exports: {} }, exports: {}, console: { log: ()=>{} } };
vm.createContext(context);
try{
  vm.runInContext(code, context, { timeout: timeLimit * 1000 });
}catch(e){
  for(const t of tests){ results.push({ input: t.input, passed: false, error: 'Initialization error: '+String(e) }); }
  console.log(JSON.stringify({ passedTests:0, totalTests: tests.length, runtimeMs:0, results }));
  process.exit(0);
}
for(const t of tests){
  const start = Date.now();
  try{
    const input = safeParse(t.input);
    context.__input = input;
    let out;
    const fn = functionName || 'solve';
    // Try different call strategies inside the VM with timeout
    try{
      out = vm.runInContext(`(typeof ${fn}==='function' ? ${fn}(__input) : (module.exports && typeof module.exports[fn] === 'function' ? module.exports[fn](__input) : (module.exports && typeof module.exports.default === 'function' ? module.exports.default(__input) : undefined)))`, context, { timeout: timeLimit * 1000 });
    }catch(e){ throw e; }
    const end = Date.now();
    const expected = safeParse(t.expectedOutput);
    const passedTest = JSON.stringify(out) === JSON.stringify(expected);
    if(passedTest) passed++;
    results.push({ input: t.input, passed: passedTest, runtimeMs: end-start });
  }catch(e){
    results.push({ input: t.input, passed: false, error: String(e) });
  }
}
const total = tests.length;
const runtime = results.reduce((s,r)=>s+(r.runtimeMs||0),0);
console.log(JSON.stringify({ passedTests: passed, totalTests: total, runtimeMs: runtime, results }));
`;

  await fs.writeFile(path.join(dir, 'executor.js'), executor, 'utf8');
}

app.post('/run', async (req, res) => {
  const { code, testCases, functionName, timeLimitSeconds, metadata } = req.body || {};
  if (!code || !Array.isArray(testCases)) return res.status(400).json({ error: 'Invalid payload' });

  const baseDir = process.env.SHARED_WORKDIR || '/work_shared';
  try { await fs.mkdir(baseDir, { recursive: true }); } catch (e) {}
  const tmp = await fs.mkdtemp(path.join(baseDir, 'code-runner-'));
  const jobId = uuidv4();
  try {
    await fs.writeFile(path.join(tmp, 'code.js'), code, 'utf8');
    await fs.writeFile(path.join(tmp, 'tests.json'), JSON.stringify(testCases), 'utf8');
    if (functionName) await fs.writeFile(path.join(tmp, 'functionName.txt'), functionName, 'utf8');
    if (timeLimitSeconds) await fs.writeFile(path.join(tmp, 'timeLimit.txt'), String(timeLimitSeconds), 'utf8');
    if (metadata) await fs.writeFile(path.join(tmp, 'metadata.json'), JSON.stringify(metadata), 'utf8');
    await writeExecutor(tmp);

    const subdir = path.basename(tmp);
    const job = { jobId, subdir, createdAt: new Date().toISOString(), metadata: metadata || null };
    // enqueue with retries
    try {
      await retry(() => redis.lpush('code_jobs', JSON.stringify(job)), 3, 300);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to enqueue job to Redis', e);
      res.status(500).json({ jobId, error: 'failed to enqueue job', details: String(e) });
      return;
    }

    // wait for worker result list: code_results:{jobId}
    const resList = `code_results:${jobId}`;
    const waitTimeoutSeconds = parseInt(process.env.RUNNER_WAIT_TIMEOUT || '20', 10);
    let r: [string, string] | null = null;
    try {
      // wrap brpop in retry in case Redis transiently fails
      r = await retry(() => redis.brpop(resList, waitTimeoutSeconds) as Promise<[string, string]>, 1, 0);
    } catch (e) {
      // timeout or redis error
      // eslint-disable-next-line no-console
      console.error('Error waiting for worker result', e);
      res.status(504).json({ jobId, error: 'timeout or error waiting for runner', details: String(e) });
      return;
    }
    if (!r || !r[1]) {
      res.status(504).json({ jobId, error: 'timeout waiting for runner' });
      return;
    }
    const raw = r[1];
    let payload = null;
    try { payload = JSON.parse(raw); } catch (e) { payload = { jobId, output: raw }; }
    // eslint-disable-next-line no-console
    console.log(`Job ${jobId} completed, returning result`);
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ error: String(err), details: err.stderr ? err.stderr.toString() : undefined });
  } finally {
    // NOTE: do not remove the job directory here — worker will clean up after execution
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Code runner listening on ${port}`);
});
