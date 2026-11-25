#!/usr/bin/env node
/**
 * End-to-end smoke test for a running CodeClash stack. No dependencies -
 * Node.js 22+ (global fetch and WebSocket).
 *
 *   node scripts/smoke-test.mjs [--api http://localhost:4000/api]
 *
 * Registers two throwaway players, has them find each other through Quick
 * Match over Socket.IO, accept the match, and plays it: one wrong submission,
 * then the reference solution for every challenge (read with the admin
 * account). Checks the real-time events, the judge verdicts, the finished
 * match, rating changes and match history. Exits non-zero on any failure.
 *
 * Admin credentials: ADMIN_EMAIL / ADMIN_PASSWORD, otherwise
 * admin@codeclash.local with SEED_ADMIN_PASSWORD from ./.env.
 */
import { readFileSync } from 'node:fs';

const argApi = process.argv.indexOf('--api');
const API = (argApi > -1 ? process.argv[argApi + 1] : process.env.API_URL) || 'http://localhost:4000/api';
const ORIGIN = new URL(API).origin;

function fromDotEnv(key) {
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@codeclash.local';
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || fromDotEnv('SEED_ADMIN_PASSWORD') || 'password123';

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
function check(cond, msg) {
  if (cond) ok(msg);
  else {
    failures++;
    console.log(`  ✗ ${msg}`);
  }
  return cond;
}
function fatal(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
const step = (msg) => console.log(`\n${msg}`);

/** A signed-in API client that keeps its own cookies. */
class Session {
  cookies = new Map();
  async call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const res = await fetch(API + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  }
  get accessToken() {
    return this.cookies.get('cc_access_token');
  }
}

/** Minimal Socket.IO v4 client over a raw WebSocket (namespace "/"). */
class Realtime {
  events = [];
  waiters = [];
  constructor(token) {
    this.token = token;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const url = `${ORIGIN.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`;
      this.ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error('socket connect timeout')), 10_000);
      this.ws.onmessage = ({ data }) => {
        const packet = String(data);
        if (packet.startsWith('0')) this.ws.send(`40${JSON.stringify({ token: this.token })}`);
        else if (packet === '2') this.ws.send('3'); // ping -> pong
        else if (packet.startsWith('40')) {
          clearTimeout(timer);
          resolve();
        } else if (packet.startsWith('44')) reject(new Error(`socket refused: ${packet}`));
        else if (packet.startsWith('42')) this.dispatch(JSON.parse(packet.slice(2)));
      };
      this.ws.onerror = () => reject(new Error('socket error'));
    });
  }
  dispatch([name, payload]) {
    this.events.push({ name, payload });
    this.waiters = this.waiters.filter((w) => {
      if (w.name !== name || !w.match(payload)) return true;
      w.resolve(payload);
      return false;
    });
  }
  emit(name, payload) {
    this.ws.send(`42${JSON.stringify([name, payload])}`);
  }
  waitFor(name, match = () => true, timeoutMs = 15_000) {
    const seen = this.events.find((e) => e.name === name && match(e.payload));
    if (seen) return Promise.resolve(seen.payload);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${name}`)), timeoutMs);
      this.waiters.push({
        name,
        match,
        resolve: (p) => {
          clearTimeout(timer);
          resolve(p);
        },
      });
    });
  }
  close() {
    this.ws?.close();
  }
}

async function main() {
  console.log(`CodeClash smoke test against ${API}`);

  step('1. Stack health');
  const health = await new Session().call('GET', '/health').catch((e) => fatal(`API unreachable: ${e.message}`));
  check(health.status === 200 && health.body?.status === 'ok', `GET /health -> ${health.status} ${JSON.stringify(health.body)}`);
  const ready = await new Session().call('GET', '/runner/ready');
  check(ready.status === 200, `code runner ready (${ready.status})`);

  step('2. Accounts');
  const admin = new Session();
  const adminLogin = await admin.call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!check(adminLogin.status === 200, `admin login (${ADMIN_EMAIL})`)) fatal('set ADMIN_EMAIL / ADMIN_PASSWORD');
  const pool = await admin.call('GET', '/admin/challenges/battle-pool');
  check(pool.body?.pool?.canStartMatch === true, `battle pool can start a match (${pool.body?.pool?.eligibleCount} eligible challenges)`);

  const tag = Date.now().toString(36);
  const players = [];
  for (const name of ['alpha', 'bravo']) {
    const s = new Session();
    const username = `smoke_${name}_${tag}`.slice(0, 30);
    const r = await s.call('POST', '/auth/register', {
      email: `${username}@example.com`,
      username,
      password: `pw-${tag}-${name}`,
    });
    if (!check(r.status === 201, `register ${username} (${r.status})`)) fatal(JSON.stringify(r.body));
    s.user = r.body.user;
    players.push(s);
  }
  const [p1, p2] = players;

  step('3. Real-time Quick Match');
  for (const p of players) {
    p.rt = new Realtime(p.accessToken);
    await p.rt.connect();
  }
  ok('both sockets authenticated');
  for (const p of players) {
    const r = await p.call('POST', '/matchmaking/quick');
    check(r.status === 201 || r.status === 200, `${p.user.username} searching (${r.body?.matchmaking?.status})`);
  }
  const found = await Promise.all(players.map((p) => p.rt.waitFor('matchmaking:match-found')));
  const matchId = found[0].matchId;
  check(!!matchId && found[1].matchId === matchId, `both received matchmaking:match-found for ${matchId}`);

  for (const p of players) {
    const r = await p.call('POST', `/matches/${matchId}/ready`);
    check(r.status < 300, `${p.user.username} accepted (${r.body?.status})`);
  }
  await Promise.all(players.map((p) => p.rt.waitFor('match:started', (e) => e.matchId === matchId)));
  ok('both received match:started');
  for (const p of players) p.rt.emit('match:join', { matchId });

  step('4. Battle');
  const list = await p1.call('GET', `/matches/${matchId}/challenges`);
  const challenges = list.body?.challenges ?? [];
  check(challenges.length === 5, `match has ${challenges.length} challenges`);

  const wrong = await p2.call('POST', `/matches/${matchId}/challenges/${challenges[0].matchChallengeId}/submit`, {
    code: 'function solve() { return null; }',
  });
  check(wrong.body?.submission?.status === 'WRONG_ANSWER', `wrong answer judged WRONG_ANSWER (${wrong.body?.submission?.status})`);

  for (const c of challenges) {
    const detail = await admin.call('GET', `/admin/challenges/${c.challenge.id}`);
    const code = detail.body?.challenge?.judge?.referenceSolutionCode;
    if (!check(!!code, `reference solution for "${c.challenge.title}"`)) continue;
    const run = await p1.call('POST', `/matches/${matchId}/challenges/${c.matchChallengeId}/run`, { code });
    const submit = await p1.call('POST', `/matches/${matchId}/challenges/${c.matchChallengeId}/submit`, { code });
    check(
      run.body?.run?.passedTests === run.body?.run?.totalTests && submit.body?.submission?.status === 'ACCEPTED',
      `"${c.challenge.title}": run ${run.body?.run?.passedTests}/${run.body?.run?.totalTests}, submit ${submit.body?.submission?.status} ${submit.body?.submission?.passedTests}/${submit.body?.submission?.totalTests}`,
    );
  }

  step('5. Result');
  const finished = await p2.rt.waitFor('match:finished', (e) => e.matchId === matchId).catch(() => null);
  check(!!finished, 'opponent received match:finished');
  const solvedEvents = p2.rt.events.filter((e) => e.name === 'challenge:solved').length;
  check(solvedEvents === 5, `opponent saw ${solvedEvents} challenge:solved events`);
  const match = (await p1.call('GET', `/matches/${matchId}`)).body?.match;
  check(match?.status === 'FINISHED' && match?.winnerId === p1.user.id, `match FINISHED, winner ${match?.winnerId === p1.user.id ? p1.user.username : match?.winnerId}`);
  check(match?.me?.ratingAfter > match?.me?.rating, `winner rating ${match?.me?.rating} -> ${match?.me?.ratingAfter}`);
  check(match?.opponent?.ratingAfter < match?.opponent?.rating, `loser rating ${match?.opponent?.rating} -> ${match?.opponent?.ratingAfter}`);
  const history = await p1.call('GET', '/matches/me/history?page=1&pageSize=5');
  check(history.body?.matches?.[0]?.matchId === matchId, 'match appears in the winner’s history');
  const board = await new Session().call('GET', '/leaderboard?limit=100');
  check(board.body?.some?.((r) => r.id === p1.user.id && r.wins >= 1), 'winner is on the leaderboard');

  for (const p of players) p.rt.close();
  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exit(failures ? 1 : 0);
}

main().catch((error) => fatal(error.stack || String(error)));
