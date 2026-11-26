# CodeClash architecture

CodeClash is a 1v1 competitive coding game. Two players get the same five
challenges (2 easy, 2 medium, 1 hard by default) and race to solve them in
the browser. Every submission is judged in an isolated sandbox. Quick Match
games are rated (Elo); private-room games with friends are casual.

## Services

```
 browser ──► frontend (Next.js, :3000)      browser ──► admin (Next.js, :7662)
    │                                           │
    └──────── HTTPS /api + Socket.IO ───────────┴──► backend (NestJS, :4000)
                                                        │      │
                                      PostgreSQL ◄──────┘      │  HTTP /v2/judge (HMAC-signed verdicts)
                                      (Prisma)                 ▼
                                      Redis ◄────────── code-runner (Express, :5000)
                                        ▲                      │ writes job dir to the shared volume,
                                        │                      │ queues it in Redis (code_jobs)
                                        └────────────── runner-worker ──► dind (Docker daemon, privileged)
                                                         pops jobs,          one locked-down container
                                                         `docker run`s       per job (node:22-alpine)
```

| Component | Code | Responsibility |
|---|---|---|
| `backend` | `backend/` (NestJS 11, Prisma 5) | Auth, matchmaking, battles, rating, rooms, invitations, profiles, admin APIs, Socket.IO gateway |
| `code-runner` | `code-runner/src/main.ts` | Judge API: accepts a job, writes it to the shared work volume, queues it, waits for the verdict and signs it |
| `runner-worker` | `code-runner/worker/src/worker.ts` | Runs queued jobs in sandbox containers on `dind`; enforces hard time and memory limits |
| judge runtime | `code-runner/src/executor/judge-runtime.js` | Runs inside the sandbox: loads player and challenge code into isolated JS realms, runs the tests, prints one JSON verdict |
| `frontend` | `frontend/` (Next.js 16) | Player app: lobby, Quick Match, rooms, battle editor (Monaco), profile, leaderboard |
| `admin` | `admin/` (Next.js 16) | Staff console: challenge authoring and validation, battle-pool health, user management |

PostgreSQL holds all durable state: users, challenges, matches, submissions
and rating history. Redis holds transient state: the matchmaking queue,
presence, room ready flags and the judge job queue.

## Key flows

### Quick Match (ranked)

1. `POST /api/matchmaking/quick` queues the player with their rating. The
   client polls `GET /api/matchmaking/quick` (which keeps the entry fresh) and
   listens on its socket.
2. A worker in the API pairs players within a rating range that widens over
   time (`MATCHMAKING_RANGE_*`) and creates a `PENDING_READY` match. Both
   players get `matchmaking:match-found`.
3. Both players `POST /api/matches/:id/ready` before `readyDeadline`
   (`MATCH_READY_TIMEOUT_SECONDS`). Otherwise the match is cancelled and the
   player who did accept goes back into the queue.
4. When both are ready, the API picks five validated challenges and starts the
   clock (`MATCH_DURATION_MINUTES`). Both players get `match:started`.

### Private room (casual)

The host creates a 1v1 room, shares its code or invites a player by username
(`invitation:received` arrives live). Once both players are in, the host
starts the match. Room changes are pushed to `room:<id>` as `room:update`.

### Battle and judging

1. The battle page loads `GET /api/matches/:id` and `/challenges`, then joins
   `match:<id>` over Socket.IO (`match:join`, participants and staff only).
2. **Run** judges the public sample tests only. **Submit** judges every test,
   including hidden ones.
3. The API builds a `RunnerJobPayload` and posts it to `code-runner`
   (`POST /v2/judge`). The runner writes `job.json` plus the judge runtime
   into a fresh directory on the shared volume and queues the job in Redis.
4. A worker pops the job and runs it in a new container on `dind`:
   `--network none --read-only --cap-drop ALL --security-opt no-new-privileges
   --user 65534 --pids-limit 64 --memory <limit+overhead> --cpus 1`, mounting
   only that job's directory, read-only. Hard timeouts remove the container.
5. The runtime prints one JSON verdict. The runner signs it with
   `RUNNER_SECRET`, and the API verifies the signature, records the
   submission and updates match progress in one transaction under a row lock.
6. The opponent sees `challenge:attempting`, `challenge:solved` and
   `match:progress`: counts only, never code or test data.
7. The match ends when a player solves all five (`match:finished`), when a
   player gives up, or when the clock runs out. On timeout, more challenges
   solved wins, then the lower total solve time; nothing solved or an exact tie
   is a draw. Rating (Quick Match only), streaks and stats are applied exactly
   once.

### Challenge validation

A challenge can only be published after it passes validation. Validation runs
the reference solution against every test in the sandbox, along with the
custom checker and test generator if the challenge has them, and stores a
fingerprint of everything that affects judging. Battles only use challenges
whose validation passed. Seeded and imported challenges are validated
automatically by `ChallengePoolBootstrapService` once a runner worker is up.

## Real-time events (Socket.IO)

Sockets authenticate with the `cc_access_token` cookie at handshake. Banned
users and revoked sessions are refused. Every socket joins `user:<id>`.

| Channel | Events |
|---|---|
| `user:<id>` | `matchmaking:searching`, `matchmaking:match-found`, `matchmaking:cancelled`, `matchmaking:opponent-unavailable`, `matchmaking:error`, `match:ready`, `match:started`, `invitation:received`, `invitation:updated` |
| `match:<id>` | `match:progress`, `challenge:attempting`, `challenge:solved`, `player:gave-up`, `match:finished`, `match:cancelled` |
| `room:<id>` | `room:update` (`{ room, ready }`, or `{ room: null }` when the room is gone) |

Client-to-server: `match:join` / `match:leave` and `room:join` / `room:leave` /
`room:ready`, each acknowledged with `{ ok, error? }`.

## Sandbox design

Two layers keep player code contained.

1. **Container.** The real security boundary: no network, read-only root
   filesystem, no Linux capabilities, an unprivileged user, and pid, memory,
   CPU and wall-clock limits, on a dedicated Docker daemon. Each container
   sees only its own job directory.
2. **JS realm.** Inside the container, `judge-runtime.js` loads the
   solution, reference solution and checker into separate `vm` contexts built
   from a null-prototype global. No host object is ever placed in them, so
   player code cannot reach `process`, `require` or the file system, and
   cannot print a forged verdict or read hidden expectations. Promise jobs
   are drained inside each evaluation (`microtaskMode: 'afterEvaluate'`), so
   per-test time limits also cover async loops.

`backend/src/modules/runner/judge-runtime.spec.ts` runs the real runtime and
includes regression tests for each known escape route.

## Authentication and roles

- Cookie-based JWT sessions (httpOnly, `SameSite=Lax`): a 15-minute access
  token and a 7-day refresh token. Both apps refresh on 401 automatically.
- Roles: `USER` < `ADMIN` < `MASTER`. Admin routes check the role from the
  database on every request, and only a `MASTER` can change roles.
- Admin password resets and self-service password changes revoke all other
  sessions (`sessionsRevokedAt`). Bans apply immediately to HTTP, refresh and
  sockets.
