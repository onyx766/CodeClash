# Developing CodeClash

The API, the code runner and both web apps can all run natively with hot reload.
PostgreSQL and Redis run in Docker.

## Prerequisites

- Node.js 22 (LTS) and npm
- Docker, which also runs player code locally: the runner worker starts
  sandbox containers on your Docker daemon, so your user needs access to it.

## 1. Databases

```bash
./scripts/init-env.sh   # once; compose needs the secrets even for the databases
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
```

PostgreSQL listens on `127.0.0.1:5432` (user `codeclash`, password
`POSTGRES_PASSWORD` from `.env`) and Redis on `127.0.0.1:6379`.

## 2. API (`backend/`, port 4000)

```bash
cd backend
cp ../.env.example .env
```

Edit `backend/.env`:

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://codeclash:<POSTGRES_PASSWORD from ../.env>@localhost:5432/codeclash
REDIS_HOST=localhost
CODE_RUNNER_URL=http://localhost:5000
JWT_ACCESS_SECRET=<any 16+ characters>
JWT_REFRESH_SECRET=<a different 16+ characters>
RUNNER_SECRET=<any value; use the same one for the runner below>
```

Then:

```bash
npm ci
npx prisma migrate deploy      # apply migrations
npm run prisma:seed            # staff accounts, demo players, starter challenges
npm run start:dev              # http://localhost:4000/api  (docs: /api/docs)
```

In development the API accepts requests from any origin, and auth cookies are
not `Secure`. The seed uses the password `password123` unless
`SEED_ADMIN_PASSWORD` / `SEED_PLAYER_PASSWORD` are set.

## 3. Code runner (`code-runner/`, port 5000)

The runner service queues jobs in Redis. The worker runs each job in a
container on your local Docker daemon. Both need the same `SHARED_WORKDIR`,
a directory the Docker daemon can bind-mount.

```bash
cd code-runner
npm ci
mkdir -p "$HOME/.codeclash/work"
```

Run the service and the worker in two terminals, each with the same variables:

```bash
export REDIS_HOST=localhost SHARED_WORKDIR="$HOME/.codeclash/work" RUNNER_SECRET=<same as backend>
npm start                                          # terminal 1: runner service on :5000
BACKEND_URL=http://localhost:4000 npm run worker   # terminal 2: worker
```

On first start the worker pulls `node:22-alpine` (the sandbox image). Once the
worker registers, the API validates the seeded challenges automatically and
matches can start.

## 4. Web apps

```bash
cd frontend && npm ci && npm run dev    # player app,    http://localhost:3000
cd admin && npm ci && npm run dev       # admin console, http://localhost:7662
```

Both reach the API at `http://<host>:4000/api` by default. Set
`NEXT_PUBLIC_API_URL` (and `NEXT_PUBLIC_WS_URL` for the player app) to point
them elsewhere.

Both apps use **Next.js 16**, which differs from older versions. Read the
guides in `node_modules/next/dist/docs/` before using a Next.js API you are
unsure about (see each app's `AGENTS.md`).

## Tests and checks

```bash
cd backend
npm test                       # unit tests (Jest); includes the real judge runtime
npx tsc --noEmit -p tsconfig.json

cd ../code-runner && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit && npm run build
cd ../admin && npx tsc --noEmit && npm run build
```

`backend/src/modules/runner/judge-runtime.spec.ts` executes
`code-runner/src/executor/judge-runtime.js` directly. It covers judging
semantics and the sandbox-isolation guarantees, so run it after any change to
the runtime.

## Database changes

```bash
cd backend
# edit prisma/schema.prisma, then:
npx prisma migrate dev --name <change>   # creates and applies a migration
```

Commit the generated `prisma/migrations/*`. Containers apply pending migrations
automatically on start.

## Useful references

- [Architecture](architecture.md): services, request flows, sandbox design
- [Deployment](deployment.md): Docker Compose, configuration, operations
- `backend/README.md`: roles and accounts, IP geolocation
