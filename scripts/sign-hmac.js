#!/usr/bin/env node
// Usage:
// node scripts/sign-hmac.js --secret S3CRET --jobId my-job --file payload.json
// or
// node scripts/sign-hmac.js --secret S3CRET --jobId my-job --body '{"jobId":"my-job"}'

const crypto = require('crypto');
const fs = require('fs');

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const secret = getArg('--secret') || process.env.RUNNER_SECRET;
const jobId = getArg('--jobId');
const file = getArg('--file');
const bodyArg = getArg('--body');

if (!secret) {
  console.error('Missing --secret or RUNNER_SECRET in env');
  process.exit(2);
}
if (!jobId) {
  console.error('Missing --jobId');
  process.exit(2);
}
let bodyStr = '{}';
if (file) {
  try { bodyStr = fs.readFileSync(file, 'utf8'); } catch (e) { console.error('Failed to read file', e.message); process.exit(2); }
} else if (bodyArg) {
  bodyStr = bodyArg;
} else {
  console.error('Provide --file path or --body string');
  process.exit(2);
}

const ts = String(Date.now());
const sig = crypto.createHmac('sha256', secret).update(`${jobId}.${ts}.${bodyStr}`).digest('hex');

function shellEscape(str) {
  // simple single-quote escaping
  return `'${String(str).replace(/'/g, "'\\''")}'`;
}

console.log('x-runner-timestamp:', ts);
console.log('x-runner-signature:', sig);
console.log('\nExample curl:');
console.log('curl -X POST http://localhost:4000/api/jobs/record \\');
console.log("  -H \"Content-Type: application/json\" \\");
console.log(`  -H \"x-runner-timestamp: ${ts}\" \\");
console.log(`  -H \"x-runner-signature: ${sig}\" \\");
console.log(`  -d ${shellEscape(bodyStr)}`);
