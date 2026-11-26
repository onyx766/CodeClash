# CodeClash

A 1v1 competitive coding game. Two players get the same five challenges and race
to solve them in the browser. Every submission is judged in an isolated sandbox.
Quick Match pairs players by Elo rating; private rooms let friends play casual
matches. Staff author, validate and publish challenges in an admin console.

## Quick start

Requires Docker with Compose v2.24+ and support for privileged containers
(the code sandbox runs on Docker-in-Docker).

```bash
./scripts/init-env.sh          # writes .env with generated secrets and prints the seed passwords
docker compose up --build -d
```

- Player app: http://localhost:3000
- Admin console: http://localhost:7662 (`admin@codeclash.local`, password from `.env`)
- API: http://localhost:4000/api (OpenAPI docs at `/api/docs` when `ENABLE_SWAGGER=true`)

The first start migrates and seeds the database, then validates the starter
challenges in the sandbox. Matches can start about a minute after the stack is up.
`node scripts/smoke-test.mjs` then plays a full ranked match end to end to
verify the deployment.

## Documentation

- [Deployment](docs/deployment.md): configuration, HTTPS, scaling, backups, troubleshooting
- [Development](docs/development.md): running each service natively, tests, migrations
- [Architecture](docs/architecture.md): services, request flows, real-time events, sandbox design

## Repository layout

| Path | What it is |
|---|---|
| `backend/` | NestJS API: auth, matchmaking, battles, rating, rooms, admin APIs, Socket.IO |
| `code-runner/` | Judge service, queue worker and the in-sandbox judge runtime |
| `frontend/` | Player app (Next.js) |
| `admin/` | Admin console (Next.js) |
| `docker-compose.yml` | The complete stack; `docker-compose.dev.yml` exposes the databases for local development |
| `scripts/` | `init-env.sh` (configuration), `smoke-test.mjs` (end-to-end check of a running stack), `sign-hmac.js` (sign runner requests by hand) |
