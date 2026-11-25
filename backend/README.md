# CodeClash backend

NestJS 11 + Prisma 5 + PostgreSQL + Redis + Socket.IO. Serves the REST API
under `/api` (OpenAPI docs at `/api/docs` - on in development, `ENABLE_SWAGGER=true`
in production - and health at `/api/health`) and the
real-time gateway on the same port (4000).

- Run everything with Docker: see [docs/deployment.md](../docs/deployment.md).
- Run natively with hot reload: see [docs/development.md](../docs/development.md).
  Configuration is read from `backend/.env`; `.env.example` at the repository
  root documents every variable.

## Scripts

```bash
npm run start:dev          # watch mode
npm run build              # compiles src/, prisma/ and scripts/ into dist/
npm run start:prod         # node dist/src/main
npm test                   # unit tests (Jest)

npm run prisma:generate    # regenerate the Prisma client after schema changes
npm run prisma:migrate     # create + apply a migration in development
npm run prisma:deploy      # apply pending migrations (non-interactive)
npm run prisma:seed        # seed staff accounts, demo players and starter challenges
```

The Docker image runs `prisma migrate deploy` and seeds an empty database on
every start (`docker-entrypoint.sh`; disable with `RUN_MIGRATIONS=false` or
`SEED_DATABASE=false`). The seed reads `SEED_ADMIN_PASSWORD`,
`SEED_PLAYER_PASSWORD` and `SEED_DEMO_PLAYERS` (default password `password123`).

## Roles

Accounts have one of three roles, in ascending order of privilege: `USER` < `ADMIN` < `MASTER`. Registration (`POST /api/auth/register`) always creates a `USER` account; the role can never be set from a request body.

Role changes are handled exclusively by `PATCH /api/admin/users/:userId/role`, which requires an authenticated `MASTER` account. At least one `MASTER` account must always exist - the endpoint rejects demoting the last remaining `MASTER`.

### Creating the first MASTER account

There is no public endpoint for this by design. The seed creates
`master@codeclash.local`. To promote another existing account to `MASTER`:

```bash
npm run create-master -- <email>                                    # from backend/
docker compose exec backend node dist/scripts/create-master.js <email>   # in Docker
```

This looks up the account by email and updates its role directly in the database. It refuses to run if no account with that email exists yet.

## Sessions

- Login sets two httpOnly cookies: a short-lived access token
  (`JWT_ACCESS_EXPIRES_IN`, default 15m) and a refresh token
  (`JWT_REFRESH_EXPIRES_IN`, default 7d, path `/api/auth`). Clients call
  `POST /api/auth/refresh` when a request returns 401.
- `COOKIE_SECURE` controls the `Secure` attribute (defaults to on in
  production); keep it `false` when serving over plain HTTP.
- `POST /api/auth/change-password` lets users change their own password. It
  and the admin password reset revoke every other session
  (`sessionsRevokedAt`). Bans take effect on the next request, refresh or
  socket connection.

## Code runner integration

Submissions and challenge validation are sent to the code runner
(`CODE_RUNNER_URL`, `POST /v2/judge`). Verdicts must carry an HMAC signature
made with `RUNNER_SECRET`. Published challenges that have never been validated
(for example the seed data) are validated automatically once a runner worker
is up (`AUTO_VALIDATE_CHALLENGES`). Battles only use challenges whose
validation passed.

## Location

IP geolocation is **off by default** (`GEOLOCATION_PROVIDER=none`): no player's IP address is sent anywhere. Set `GEOLOCATION_PROVIDER=ip-api` (free, plain HTTP) or `ipapi` (HTTPS, optional `GEOLOCATION_API_KEY`) to enable it; tell your players, since their IP is then shared with that provider.

When enabled, on registration and successful login the API makes a best-effort attempt to resolve `country`/`region`/`city`/`timezone` from the request's public IP address (see `GeolocationService`). This is approximate - derived from network IP, not GPS - and can be inaccurate or unavailable behind VPNs, proxies, mobile networks, or corporate NAT. Local/private IPs are never sent to the geolocation provider, and a failed or slow lookup never blocks registration or login. No street address, postal address, or GPS coordinates are ever requested or stored, and the raw IP itself is not persisted.
