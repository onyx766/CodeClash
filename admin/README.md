# CodeClash admin console

The staff console for CodeClash: a Next.js 16 app on port **7662** where ADMIN
and MASTER accounts manage challenges and player accounts. It runs entirely in
the browser and talks to the CodeClash API with the same httpOnly cookies as
the player app. The API checks the caller's role on every `/api/admin/*`
request, so nothing in the console grants access by itself.

## What it does

- **Users**: search, filter and sort accounts, edit profiles, create accounts,
  ban and unban, and reset the password of accounts ranked below yours. A
  MASTER can also change roles.
- **Challenges**: write a challenge by hand, import it from JSON, or generate a
  draft with AI (only when the API has `AI_SERVICE_URL` set). Validate it in
  the sandboxed code runner, then publish it. A published challenge keeps its
  judging (contract, tests, limits) frozen, but its title, description,
  difficulty and tags can still be edited. Archive it to take it out of
  rotation; delete drafts and archived challenges that no match has used.
- **Battle pool** (on the Challenges page): which published challenges matches
  can use and why the others cannot, whether the runner is reachable, and a
  button that validates the published challenges that have not passed yet
  (up to 50 per run).
- **Your account**: change your own password from the account menu (top right).
  This signs out your other sessions.

The sidebar also lists planned sections under **Coming soon** (Matches, Rooms,
Submissions, Leaderboard, Shop, Achievements, Reports, Settings). Their pages
say they are not built yet.

## Running it

### With the whole stack (Docker)

From the repository root:

```bash
./scripts/init-env.sh          # once: writes .env and prints the generated passwords
docker compose up --build -d
```

Then open http://localhost:7662. See [docs/deployment.md](../docs/deployment.md)
for HTTPS, other hosts and the full configuration.

### Development

The API must be running on port 4000 (see
[docs/development.md](../docs/development.md)). Then:

```bash
cd admin
npm ci
npm run dev        # http://localhost:7662
```

Checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The build uses `output: "standalone"`, which is what the Docker image runs
(`node server.js`). `npm start` also works after a build, with a warning from
Next.js about that setting.

This project uses Next.js 16, which differs from older versions. Read the
guides in `node_modules/next/dist/docs/` before using an API you are unsure
about (see [AGENTS.md](AGENTS.md)).

## Configuration

The console has two optional settings. Both are `NEXT_PUBLIC_*` variables, so
they are compiled in at build time (Docker Compose passes them as build
arguments; rebuild with `docker compose up --build -d` after changing them).

| Variable | Default when empty | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `<protocol>//<host>:4000/api`, from the address the console was opened at | Base URL of the CodeClash API. |
| `NEXT_PUBLIC_PLAYER_APP_URL` | `<protocol>//<host>:3000`, from the address the console was opened at | Target of the **Main site** links. |

Set them only when the API or the player app is served from a different
origin, for example behind a reverse proxy.

### What the API needs

- **`ADMIN_FRONTEND_URL` must list the console's origin** (scheme, host and
  port, comma-separated, for example
  `http://localhost:7662,http://192.168.1.20:7662`) whenever the API runs with
  `NODE_ENV=production`, as it does in Docker Compose. Otherwise the browser
  blocks every API call and the console reports that it could not reach the
  API at that address. A development API (`NODE_ENV=development`) accepts any
  origin.
- `COOKIE_SECURE=true` when the console and the API are served over HTTPS.

## Signing in

The seed creates two staff accounts:

| Account | Role |
|---|---|
| `master@codeclash.local` | MASTER |
| `admin@codeclash.local` | ADMIN |

Both use `SEED_ADMIN_PASSWORD` from the root `.env`, which
`scripts/init-env.sh` generates and prints. If that variable was empty when the
database was first seeded, the password is `password123`: change it at once
with **Change password** in the account menu. Player accounts (role USER) are
refused and signed out again.

Sessions renew themselves: access tokens last `JWT_ACCESS_EXPIRES_IN` (15
minutes by default), and the console refreshes them with the refresh cookie,
which lasts `JWT_REFRESH_EXPIRES_IN` (7 days). When a session cannot be
renewed, the console shows the sign-in page and returns you to the page you
were on after you sign in.

### Use a separate browser profile

The console and the player app share the same login cookies, which the API sets
for its own host. In one browser profile, signing in to the console as an admin
also switches an open player-app tab to that admin account, and signing out of
either app signs out of both. Use a separate browser profile, or a private
window, for admin work.

## Project layout

| Path | Contents |
|---|---|
| `app/` | Routes: `/login`, `/` (dashboard), `/users`, `/challenges`, `/challenges/create`, `/challenges/[id]`, and the Coming soon placeholders. |
| `components/` | Screens and widgets by area (`challenges/`, `users/`, `layout/`) and the shared UI kit (`ui/`). |
| `hooks/useAdminAuth.tsx` | Session state, sign-in and sign-out, and the `useRequireAdmin` route guard. |
| `lib/api.ts` | API client: sends the cookies, unwraps the `{ success, error: { code, message } }` envelope, and renews an expired session once before retrying a request. |
| `services/` | One function per admin API endpoint. |
| `lib/types.ts`, `lib/draft.ts` | Types mirroring the API, and the challenge editor's draft model. |

## Troubleshooting

- **"Could not reach the CodeClash API at …"**: the API is not running at that
  address, or the console's origin (shown in the message) is missing from
  `ADMIN_FRONTEND_URL`.
- **"This account is a USER and does not have administrator access"**: sign in
  with a staff account. A MASTER can promote an account from the Users page.
- **Matches cannot start**: open Challenges and check the Battle pool panel. The
  runner must be reachable and enough published challenges must have passed
  validation; **Check unvalidated** runs the missing checks.
