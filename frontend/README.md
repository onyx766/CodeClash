# CodeClash player app

The player-facing side of CodeClash: a Next.js 16 app on port **3000** where
players find opponents, battle through five coding challenges against the
clock and climb the leaderboard. It runs entirely in the browser and talks to
the CodeClash API over HTTP (httpOnly cookie sessions) and Socket.IO. The API
is the source of truth for everything: the app never decides a verdict, a
score, a winner or a rating.

## What it does

- **Lobby**: start a ranked **Quick Match**, create a private room, join one by
  its code (invite links like `/lobby?code=AB12CD` open the form pre-filled),
  accept room invitations as they arrive, return to an unfinished match, and
  see recent results and the top players.
- **Quick Match**: a ranked search for an opponent near your rating. The search
  keeps running while you browse (a small indicator shows it on other pages).
  When a match is found, both players accept a short ready check; a tab in the
  background flashes "Match found!" in its title. If your opponent does not
  accept in time you go straight back into the queue; if you do not, the match
  is cancelled and you are out of the queue.
- **Private rooms**: casual 1v1 rooms. Share the room code or invite a player by
  username; the host starts the match. Room results never change ratings.
- **Battles**: five challenges, a JavaScript editor (Monaco), **Run** for the
  public sample tests and **Submit** for every test (Ctrl+Enter and
  Ctrl+Shift+Enter), the opponent's progress, a match log, giving up, and the
  result with the rating change. A reload or a dropped connection recovers the
  whole battle.
- **Challenges**: the published catalogue that battles draw from, by
  difficulty and tag.
- **Leaderboard**: the ranked standings and your own rank. Players with equal
  ratings share a rank (1, 1, 1, 4, ...).
- **Profile**: ranked and casual records, a rating chart, match history, profile
  editing and password changes.

The home, Leaderboard, How It Works and Community pages are open to guests;
the lobby, challenges, rooms, battles and the profile need an account.

## Running it

### With the whole stack (Docker)

From the repository root:

```bash
./scripts/init-env.sh          # once: writes .env and prints the generated passwords
docker compose up --build -d
```

Then open http://localhost:3000. The seed creates demo players
`player1@codeclash.local` to `player5@codeclash.local` with
`SEED_PLAYER_PASSWORD` from the root `.env`. See
[docs/deployment.md](../docs/deployment.md) for HTTPS, other hosts and the full
configuration.

### Development

The API must be running on port 4000, and matches need the code runner (see
[docs/development.md](../docs/development.md)). Then:

```bash
cd frontend
npm ci
npm run dev        # http://localhost:3000
```

Checks:

```bash
npx tsc --noEmit
npm run lint
npm test           # unit tests (Vitest)
npm run build
```

Unit tests live next to the code they test (`*.test.ts`, `*.test.tsx`) and run
in Node; `vitest.config.ts` maps the `@/` alias like `tsconfig.json`. They
cover the session and socket recovery (`lib/api.ts`, `lib/socket.ts`, with a
fake server and a fake socket.io-client), the sign-in redirect checks
(`lib/navigation.ts`), the Quick Match helpers and a few components.

The build uses `output: "standalone"`, which is what the Docker image runs
(`node server.js`). `npm start` also works after a build, with a warning from
Next.js about that setting.

This project uses Next.js 16, which differs from older versions. Read the
guides in `node_modules/next/dist/docs/` before using an API you are unsure
about (see [AGENTS.md](AGENTS.md)).

## Configuration

The app has two optional settings. Both are `NEXT_PUBLIC_*` variables, so they
are compiled in at build time (Docker Compose passes them as build arguments;
rebuild with `docker compose up --build -d` after changing them).

| Variable | Default when empty | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `<protocol>//<host>:4000/api`, from the address the app was opened at | Base URL of the CodeClash API. |
| `NEXT_PUBLIC_WS_URL` | `<protocol>//<host>:4000`, from the address the app was opened at | Socket.IO server (the API). |

Set them only when the API is served from a different origin, for example
behind a reverse proxy.

### What the API needs

- **`FRONTEND_URL` must list every origin the app is opened from** (scheme,
  host and port, comma-separated, for example
  `http://localhost:3000,http://192.168.1.20:3000`) whenever the API runs with
  `NODE_ENV=production`, as it does in Docker Compose. Otherwise the browser
  blocks the API calls and the app says it cannot reach the server. A
  development API (`NODE_ENV=development`) accepts any origin.
- `COOKIE_SECURE=true` when the app and the API are served over HTTPS.

## How it works

### Sessions

The API keeps the session in httpOnly cookies: an access token that lasts
`JWT_ACCESS_EXPIRES_IN` (15 minutes by default) and a refresh token that lasts
`JWT_REFRESH_EXPIRES_IN` (7 days). `lib/api.ts` sends every request with those
cookies. A request that comes back 401 renews the session once with
`POST /auth/refresh` and is replayed; concurrent 401s share one refresh.

- A refresh refused with 401 is checked once more with `GET /auth/me` before
  the session ends: another tab may just have received new cookies, for
  example after changing the password there (which signs out every other
  session).
- A refresh that gets no answer, a 5xx or a 429 never signs anyone out; the
  request fails with "Your session could not be renewed right now".
- A banned account is signed out at once, and the login page says the account
  has been suspended.
- Ending a session only signs out this tab. It never calls `/auth/logout`,
  which would clear the cookies every tab of the browser shares.

The login page brings the player back to where they were (`?next=`), but only
to a path on this site (`safeNextPath` in `lib/navigation.ts`).

### The socket

Each signed-in player has one Socket.IO connection (`lib/socket.ts`, read with
`useSocket()`), authenticated at the handshake by the access cookie. It is
replaced after every session renewal, so the handshake always carries the
current cookie.

- When the server refuses a handshake (`connect_error` with `UNAUTHENTICATED`
  or `SESSION_REVOKED`) or disconnects a live socket (ban, password reset or
  change), the app waits about a second, renews the session and connects a new
  socket, backing off up to 30 s while that keeps failing. The short wait lets
  a password change made in another tab store its new cookies first.
  `ACCOUNT_BANNED` ends the session instead.
- Network errors are left to socket.io's own reconnection.

Socket events only say that something changed. Pages then re-read the state
over HTTP (`GET /matches/:id` for a battle), and every re-read is numbered so a
late answer never replaces a newer one. That is why a reload or a reconnect
recovers everything.

### Quick Match

`QuickMatchProvider` (`hooks/useQuickMatch.tsx`) sits above every page.
`POST /matchmaking/quick` joins the queue; while searching the app polls
`GET /matchmaking/quick` every 3 s, which is also the heartbeat (the API drops
a searcher it has not heard from for about 10 s). On the player's socket:

| Event | What the app does |
|---|---|
| `matchmaking:match-found` | Opens `/match/:id` for the ready check; flashes the tab title when the tab is in the background. |
| `matchmaking:opponent-unavailable` | You accepted, your opponent did not: you are back in the queue. |
| `matchmaking:cancelled` | `READY_TIMEOUT`: you did not accept in time (not requeued). `START_FAILED`: both accepted, but the match could not start. `STALE`: dropped from the queue for a lost connection. `JOINED_ROOM`: you took a room seat, so the search ended quietly. |
| `match:started` | Opens the battle. |

The battle page (`hooks/useBattle.ts`) shows the ready check from
`GET /matches/:id` (each player's `ready` flag and the `readyDeadline`), so a
reload during the ready check keeps the countdown and who has accepted. It
polls every 2 s while the match waits to start, in case an event is missed.

### The editor

The battle editor is Monaco, served by this app instead of a CDN, so it works
on offline and LAN installs and no player's IP address goes to a third party:

- `monaco-editor` is pinned to the version `@monaco-editor/loader` expects
  (0.55.1). A unit test fails when they drift apart, for example after
  upgrading `@monaco-editor/react`: update the pin to the version it names.
- `scripts/copy-monaco.mjs` copies `node_modules/monaco-editor/min/vs` to
  `public/monaco/vs` before every `npm run dev` and `npm run build` (the
  `predev` and `prebuild` scripts), so the Docker image builds its own copy.
  The copy is generated: git and the Docker build context ignore it.
- `lib/monaco.ts` points the loader at `/monaco/vs` before the editor mounts.

## Project layout

| Path | Contents |
|---|---|
| `app/` | Routes: `/` (home), `/login`, `/register`, `/lobby`, `/challenges`, `/leaderboard`, `/profile`, `/rooms/[roomId]`, `/match/[matchId]`, `/how-it-works`, `/community`. |
| `components/` | Screens and widgets by area: `app/` (lobby, side panels, Quick Match), `battle/` (battle panels, ready check), `profile/`, `home/`, `auth/`, `layout/`, `charts/`, and the shared `ui/` kit. |
| `hooks/` | `useAuth` (session and the socket's lifecycle), `useQuickMatch`, `useBattle`, `useActiveMatch`, `useProfile`, `useLeaderboard`, `useSocket`. |
| `lib/api.ts` | API client: sends the cookies, unwraps the `{ success, error: { code, message } }` envelope, and renews an expired session. |
| `lib/socket.ts` | The player's Socket.IO connection and its recovery. |
| `lib/` (others) | API shapes (`battle.ts`, `matchmaking.ts`), sign-in redirects (`navigation.ts`), the profile form (`profileForm.ts`), Monaco hosting (`monaco.ts`), helpers. |
| `scripts/copy-monaco.mjs` | Copies the Monaco editor into `public/monaco/`. |

## Troubleshooting

- **"Cannot reach the server. Check your connection and try again."**: the API
  is not running at `<host>:4000` (or at `NEXT_PUBLIC_API_URL`), or the app's
  origin is missing from `FRONTEND_URL`.
- **Signed out right after signing in, over plain HTTP**: the API sets `Secure`
  cookies. Set `COOKIE_SECURE=false`, or serve over HTTPS.
- **The battle editor never appears**: `public/monaco/vs` is missing. It is
  created by `npm run dev` and `npm run build`, not by calling `next dev` or
  `next build` directly; run `node scripts/copy-monaco.mjs` once.
- **Quick Match never finds an opponent**: it needs a second player searching
  within the rating range, which widens the longer you wait.
- **Matches cannot start**: the API needs a reachable code runner and enough
  validated challenges. The admin console's Battle pool panel shows both.
- **Signing in to the admin console switches the player app's account**: both
  apps share the API's login cookies. Use a separate browser profile, or a
  private window, for admin work.
