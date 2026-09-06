# CodeClash
This is project about JS testing system, this is related with AI, 

## Authentication (local dev)

The backend (`backend/`, NestJS + Prisma + PostgreSQL) exposes a cookie-based auth system under `/api/auth`:

- `POST /api/auth/register` — create an account (Argon2id password hashing, 201 on success)
- `POST /api/auth/login` — log in (generic error on bad credentials, no account enumeration)
- `POST /api/auth/refresh` — rotate the access token using the refresh cookie
- `POST /api/auth/logout` — clear the auth cookies
- `GET /api/auth/me` — return the current authenticated user (401 if not authenticated)

Access/refresh tokens are short-lived JWTs delivered as `httpOnly`, `SameSite=lax` cookies (never exposed to frontend JS). Configure these environment variables (see `.env.example`):

```env
JWT_ACCESS_SECRET=   # long random string, e.g. `openssl rand -base64 48`
JWT_REFRESH_SECRET=  # a DIFFERENT long random string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

Setup:

```bash
cd backend
npm install
cp ../.env.example .env   # then fill in real secrets/DATABASE_URL for local dev
npx prisma generate
npx prisma migrate dev    # applies the schema (creates prisma/migrations on first run)
npm run start:dev
```

The frontend must call these endpoints with `credentials: "include"` so the browser sends/receives the auth cookies. Login/register requests are rate-limited (5–10 requests/minute per IP) via `@nestjs/throttler`.

Run the auth test suite with:

```bash
cd backend
npm test -- src/modules/auth
```

## Docker secret for runner (local dev)

The code runner and worker use an HMAC secret to sign job result POSTs. For local development we rely on a Docker secret named `runner_secret`.

Create the secret using the helper script:

```bash
./scripts/create-secret.sh "your-strong-secret-value"
```

This will initialize Docker Swarm if necessary and create the secret. Then start the stack:

```bash
docker compose up -d --build
```

Notes:
- In production use your orchestrator's secret store (Kubernetes Secret, Vault, etc.) and do not check the secret into source control.
- The backend and worker will also accept `RUNNER_SECRET` via env var if you prefer to inject it that way.

If you want me to add automatic secret rotation or a small utility to verify signatures locally, say so and I'll add it.

### Secret utilities

I added helper scripts in `scripts/`:

- `scripts/create-secret.sh "value"` — create the `runner_secret` Docker secret (initializes swarm if needed).
- `scripts/remove-secret.sh` — remove the `runner_secret` secret locally.
- `scripts/rotate-secret.sh "new-value"` — rotate the secret by replacing `runner_secret`.

Usage example:

```bash
./scripts/create-secret.sh "s3cure-value"
docker compose up -d --build
# later rotate
./scripts/rotate-secret.sh "n3w-value"
```

### HMAC signer helper

Use the small Node script to generate `x-runner-timestamp` and `x-runner-signature` values for manual curl testing.

```bash
# sign from a JSON file
node scripts/sign-hmac.js --secret "your-secret" --jobId "test-job" --file ./payload.json

# or inline body
node scripts/sign-hmac.js --secret "your-secret" --jobId "test-job" --body '{"jobId":"test-job","metadata":{}}'
```

The script prints the two headers and an example `curl` command you can paste to test the backend endpoint.
