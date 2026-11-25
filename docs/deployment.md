# Deploying CodeClash

CodeClash ships as a single Docker Compose stack. One command builds and starts
everything: the database, the API, the sandboxed code runner and both web apps.

## Requirements

- Docker Engine 24+ with **Docker Compose v2.24+** (`docker compose version`)
- Support for **privileged containers**: submissions run in containers on a
  Docker-in-Docker daemon (`dind`). Rootless Docker and some managed
  container platforms do not allow this.
- About 3 GB of free RAM for building the images, and about 1 GB while running.
- Outbound internet access during the build (npm packages, base images) and on
  first start (the runner pulls its sandbox image, `node:22-alpine`).

## Quick start

```bash
git clone <your fork of CodeClash> && cd CodeClash
./scripts/init-env.sh          # writes .env with generated secrets and passwords
docker compose up --build -d   # first build takes a few minutes
```

| Service       | URL                                  |
|---------------|--------------------------------------|
| Player app    | http://localhost:3000                |
| Admin console | http://localhost:7662                |
| API           | http://localhost:4000/api            |
| API docs      | http://localhost:4000/api/docs (set `ENABLE_SWAGGER=true`) |
| Health        | http://localhost:4000/api/health     |

On first start the API applies database migrations and seeds an empty
database with staff accounts, demo players and 17 starter challenges (6 easy,
7 medium, 4 hard). It then validates those challenges in the sandbox
automatically, which takes about ten seconds once the runner is up. Matches can
start once that finishes:

```bash
docker compose logs backend | grep ChallengePoolBootstrap
# ... Automatic challenge validation finished: 17 passed, 0 failed, 0 errored.
```

### Verifying a deployment

`scripts/smoke-test.mjs` plays a complete ranked match through the public API
and Socket.IO. Two throwaway players find each other via Quick Match, accept,
get judged (one wrong answer, then correct solutions) and finish, and the test
checks the result, rating changes, history and leaderboard. It needs Node.js 22+
and no dependencies, and reads the admin password from `.env`:

```bash
node scripts/smoke-test.mjs                      # or: --api https://api.example.com/api
```

### Accounts

`init-env.sh` prints the generated passwords and stores them in `.env`:

| Account                          | Role   | Password (in `.env`)   |
|----------------------------------|--------|------------------------|
| `master@codeclash.local`         | MASTER | `SEED_ADMIN_PASSWORD`  |
| `admin@codeclash.local`          | ADMIN  | `SEED_ADMIN_PASSWORD`  |
| `player1..5@codeclash.local`     | USER   | `SEED_PLAYER_PASSWORD` |

Players can also register in the player app. Change the staff passwords from
the admin console (account menu, then **Change password**) before you give
anyone else access. Set `SEED_DEMO_PLAYERS=false` before the first start to
skip the demo players.

The player app and the admin console share the same login cookie in a browser
profile. Use a separate profile, or a private window, for admin work.

## Configuration

All settings live in `.env`; `.env.example` documents every variable. The ones
you are most likely to change:

| Variable | Default | Purpose |
|---|---|---|
| `FRONTEND_URL` | `http://localhost:3000,http://127.0.0.1:3000` | Origins allowed to call the API from the player app (comma-separated). Add every address people use, e.g. `http://192.168.1.20:3000`. |
| `ADMIN_FRONTEND_URL` | `http://localhost:7662,http://127.0.0.1:7662` | The same, for the admin console. |
| `COOKIE_SECURE` | `false` | Set `true` when the apps are served over HTTPS. |
| `TRUST_PROXY_HOPS` | `0` | Number of reverse proxies in front of the API, so rate limiting and logs see real client addresses. |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | Session lifetimes. The apps refresh access tokens automatically. |
| `WORKER_CONCURRENCY` | `2` | Submissions each runner worker judges at once. |
| `SANDBOX_IMAGE` | `node:22-alpine` | Image that player code runs in. |
| `AUTO_VALIDATE_CHALLENGES` | `true` | Validate published, never-checked challenges in the sandbox automatically. |
| `THROTTLE_LIMIT` / `THROTTLE_TTL_MS` | `300` / `60000` | Global rate limit per client address. |
| `ENABLE_SWAGGER` | `false` in production | Serve the interactive API docs at `/api/docs`. |
| `GEOLOCATION_PROVIDER` | `none` | Opt-in IP geolocation for profiles (`ip-api`, `ipapi`); enabling it shares players' IP addresses with that provider. |
| `MATCH_*`, `MATCHMAKING_*` | see `.env.example` | Match length, challenge mix, matchmaking ranges. |

`docker compose up -d` picks up changes to `.env`. `NEXT_PUBLIC_*` values are
compiled into the web apps, so changing them needs `docker compose up --build -d`.

### Opening the apps from other devices

By default the apps call the API on port 4000 of whatever host served the page,
so `http://<server-ip>:3000` works without rebuilding. Add that origin to
`FRONTEND_URL` (and `http://<server-ip>:7662` to `ADMIN_FRONTEND_URL`), then
`docker compose up -d`. Otherwise the browser blocks the API calls, which shows
up as "cannot reach the server".

### HTTPS and a reverse proxy

To serve CodeClash under one domain (for example `https://play.example.com`
for the app, `https://admin.example.com` for the console and
`https://api.example.com` for the API):

1. Route each hostname to the matching port (3000, 7662, 4000). The API also
   serves WebSockets at `/socket.io/`, so enable WebSocket upgrades.
2. In `.env`, set:
   ```
   NEXT_PUBLIC_API_URL=https://api.example.com/api
   NEXT_PUBLIC_WS_URL=https://api.example.com
   NEXT_PUBLIC_PLAYER_APP_URL=https://play.example.com
   FRONTEND_URL=https://play.example.com
   ADMIN_FRONTEND_URL=https://admin.example.com
   COOKIE_SECURE=true
   TRUST_PROXY_HOPS=1
   ```
3. Rebuild: `docker compose up --build -d`.

Auth cookies are `SameSite=Lax`, so the apps and the API must share a
registrable domain (`*.example.com` above).

## Operating the stack

```bash
docker compose ps                       # status and health
docker compose logs -f backend          # API logs (also: runner-worker, code-runner)
docker compose up --build -d            # upgrade after `git pull` (migrations run automatically)
docker compose down                     # stop, keep data
docker compose down -v                  # stop and DELETE all data (database, sandbox cache)
```

### Scaling the judge

Each worker judges `WORKER_CONCURRENCY` submissions at a time, and each
submission gets one CPU (`SANDBOX_CPUS`). Add workers when submissions queue up:

```bash
docker compose up -d --scale runner-worker=3
```

Queue depth and worker count are shown in the admin console (Challenges, then
Battle pool) and at `GET /api/runner/status` (staff only).

### Backups

```bash
docker compose exec postgres pg_dump -U codeclash codeclash > codeclash-$(date +%F).sql
cat codeclash-YYYY-MM-DD.sql | docker compose exec -T postgres psql -U codeclash codeclash
```

Redis only holds transient state (matchmaking queue, ready flags, judge
queue), so it does not need backups.

## Security model

- Player code never runs in the API. Every submission and every challenge
  validation runs in a fresh container on the `dind` daemon. The container has
  no network, a read-only filesystem, no capabilities and an unprivileged user,
  with memory, CPU, process and wall-clock limits. It mounts only its own job
  directory. Inside the container the code runs in a separate JavaScript realm
  that has no access to Node.js (`process`, `require`, the file system).
- The privileged `dind` daemon is reachable only from the runner worker
  (`sandbox` network). PostgreSQL, Redis and the runner are not published on
  the host.
- Judge verdicts are signed with `RUNNER_SECRET` (HMAC-SHA256), and the API
  rejects unsigned or altered verdicts.
- Sessions use httpOnly cookies. Access tokens expire after 15 minutes; bans
  and admin password resets take effect immediately.

## Troubleshooting

**"Not enough eligible challenges are available to start a match."**
Matches need at least `MATCH_CHALLENGE_COUNT` (5) published challenges that
passed validation. Check `docker compose logs backend | grep ChallengePoolBootstrap`
and the Battle pool panel in the admin console. Validation retries
automatically while the runner is starting.

**The runner never becomes ready.** `docker compose logs dind runner-worker`.
`dind` must run privileged. On first start the worker pulls `SANDBOX_IMAGE`
before it registers.

**Login works but the app keeps logging me out.** The browser is dropping
`Secure` cookies on plain HTTP. Set `COOKIE_SECURE=false`, or serve over HTTPS.

**"Cannot reach the server" from another device.** Add that device's origin
(for example `http://192.168.1.20:3000`) to `FRONTEND_URL` / `ADMIN_FRONTEND_URL`.

**`docker compose` fails with `RUNNER_SECRET is not set`.** Run
`./scripts/init-env.sh` (or copy `.env.example` to `.env` and fill in the secrets).
