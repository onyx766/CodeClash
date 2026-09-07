# CodeClash backend

NestJS 11 + Prisma 5 + PostgreSQL API. See `.env.example` (repo root) for required environment variables.

## Roles

Accounts have one of three roles, in ascending order of privilege: `USER` < `ADMIN` < `MASTER`. Registration (`POST /api/auth/register`) always creates a `USER` account; the role can never be set from a request body.

Role changes are handled exclusively by `PATCH /api/admin/users/:userId/role`, which requires an authenticated `MASTER` account. At least one `MASTER` account must always exist - the endpoint rejects demoting the last remaining `MASTER`.

### Creating the first MASTER account

There is no public endpoint for this by design. To promote an existing account to `MASTER`:

1. Register the account normally through the app (`POST /api/auth/register`), or via `npm run prisma:seed`.
2. From `backend/`, run:

   ```bash
   npm run create-master -- <email>
   ```

   This looks up the account by email and updates its role directly in the database. It refuses to run if no account with that email exists yet.

## Location

On registration and successful login, the API makes a best-effort attempt to resolve `country`/`region`/`city`/`timezone` from the request's public IP address (see `GeolocationService`). This is approximate - derived from network IP, not GPS - and can be inaccurate or unavailable behind VPNs, proxies, mobile networks, or corporate NAT. Local/private IPs are never sent to the geolocation provider, and a failed or slow lookup never blocks registration or login. No street address, postal address, or GPS coordinates are ever requested or stored, and the raw IP itself is not persisted.

## Database

```bash
npm run prisma:generate   # regenerate the Prisma client after schema changes
npx prisma migrate deploy # apply pending migrations (non-interactive)
npm run prisma:seed       # seed sample users/challenges (includes a MASTER and an ADMIN)
```
