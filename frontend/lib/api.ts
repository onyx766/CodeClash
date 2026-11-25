import type { Difficulty, MatchHistoryPage } from './battle';
import type { MatchmakingResponse, ReadyResponse } from './matchmaking';

// NEXT_PUBLIC_API_URL overrides this for deployments where the API lives on
// a different host. Otherwise, derive it from whatever host the browser used
// to load the page - this stays correct even when accessed via a VPN IP that
// changes between sessions, since that same host just served the page.
function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000/api`;
  }
  return 'http://localhost:4000/api';
}

const BASE = getApiBase();

type ApiErrorBody = {
  success?: false;
  error?: { code?: string; message?: string; [field: string]: unknown };
};

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Extra fields of the error envelope, e.g. MATCH_ALREADY_FOUND's matchId. */
  details: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// session renewal
//
// Access tokens are short-lived (JWT_ACCESS_EXPIRES_IN, 15 minutes by default)
// and live in an httpOnly cookie. When a request comes back 401, the client
// renews the session through POST /auth/refresh - which reads the httpOnly
// refresh cookie - and replays the request once. Concurrent 401s share one
// refresh. When the refresh is refused, or the account turns out to be
// banned, the session is over: everything registered with onSessionExpired is
// told, and the auth provider signs the player out.
// ---------------------------------------------------------------------------

/**
 * Endpoints whose 401 means "wrong credentials" or "no session to renew",
 * never "renew and retry". Refreshing on these would loop or mask the error.
 */
const NO_REFRESH = /\/auth\/(?:login|register|refresh|logout)\/?(?:[?#]|$)/;

export type RefreshOutcome = 'refreshed' | 'rejected' | 'unavailable';

/** Why a session ended without the player logging out. */
export type SessionEndReason = 'expired' | 'banned';

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Bumped after every successful refresh. A request remembers the value it was
 * sent under, so a 401 that arrives after another request already renewed the
 * session is simply replayed instead of triggering a second refresh.
 */
let sessionGeneration = 0;

const expiredListeners = new Set<(reason: SessionEndReason) => void>();
const refreshedListeners = new Set<() => void>();

function notify<Args extends unknown[]>(listeners: Set<(...args: Args) => void>, ...args: Args) {
  listeners.forEach((listener) => {
    try {
      listener(...args);
    } catch (err) {
      console.error(err);
    }
  });
}

/** Called when the session can no longer be renewed, with why. Returns an unsubscribe function. */
export function onSessionExpired(listener: (reason: SessionEndReason) => void): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

/**
 * Ends the session in this tab: every onSessionExpired listener is told, and
 * the auth provider signs the player out. Deliberately never calls the API:
 * POST /auth/logout would clear the cookies, which this browser shares with
 * every other tab - one of which may just have received new ones.
 */
export function endSession(reason: SessionEndReason) {
  notify(expiredListeners, reason);
}

/**
 * Called after every successful renewal. The server authenticates sockets
 * only at the handshake, so the socket is recreated to pick up the new cookie.
 */
export function onSessionRefreshed(listener: () => void): () => void {
  refreshedListeners.add(listener);
  return () => {
    refreshedListeners.delete(listener);
  };
}

type Renewal = { outcome: 'refreshed' | 'unavailable' } | { outcome: 'rejected'; reason: SessionEndReason };

async function errorCodeOf(res: Response): Promise<string | undefined> {
  try {
    return ((await res.json()) as ApiErrorBody | null)?.error?.code;
  } catch {
    return undefined;
  }
}

/** A request that got no answer at all (offline, DNS, refused connection) is null. */
async function tryFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}

async function renew(): Promise<Renewal> {
  const res = await tryFetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (res?.ok) return { outcome: 'refreshed' };
  // 403: the account was banned. No answer, 429 or 5xx is transient and must
  // never sign anyone out.
  if (res?.status === 403) {
    return { outcome: 'rejected', reason: (await errorCodeOf(res)) === 'ACCOUNT_BANNED' ? 'banned' : 'expired' };
  }
  if (res?.status !== 401) return { outcome: 'unavailable' };

  // 401: the refresh cookie is missing, expired or revoked - or another tab
  // has just replaced it. A password change revokes every session but the one
  // that made it, and re-issues that tab's cookies; the browser shares them
  // with this tab, possibly only after this refresh went out with the old
  // one. Check once whether the cookies held now are valid before giving up.
  const me = await tryFetch(`${BASE}/auth/me`, { credentials: 'include' });
  if (me?.ok) return { outcome: 'refreshed' };
  if (me?.status === 401) return { outcome: 'rejected', reason: 'expired' };
  if (me?.status === 403 && (await errorCodeOf(me)) === 'ACCOUNT_BANNED') return { outcome: 'rejected', reason: 'banned' };
  return { outcome: 'unavailable' };
}

/**
 * Renews the session. Concurrent callers share one POST /auth/refresh. A
 * refused refresh ends the session (see endSession), once; an unavailable one
 * never does.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = renew()
      .then((renewal) => {
        if (renewal.outcome === 'refreshed') {
          sessionGeneration += 1;
          notify(refreshedListeners);
        } else if (renewal.outcome === 'rejected') {
          endSession(renewal.reason);
        }
        return renewal.outcome;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------------------
// requests
// ---------------------------------------------------------------------------

async function send(method: string, url: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects when no HTTP response arrived at all: offline, DNS,
    // a refused connection, or a CORS rejection of this origin.
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', 'NETWORK_ERROR');
  }
}

/** `renewal` is how renewing the session went, for a 401 that tried to. */
function errorMessage(res: Response, renewal: RefreshOutcome | null, code?: string, message?: string) {
  if (res.status === 401 && renewal) {
    // The session may well still be valid: the server that renews it did not
    // answer, or was too busy to.
    if (renewal === 'unavailable') return 'Your session could not be renewed right now. Please try again in a moment.';
    return 'Your session has expired. Please sign in again.';
  }
  // The rate limiter answers with its class name ("ThrottlerException: ...").
  if (res.status === 429 && (!code || code === 'ERROR')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  return message || `API ${res.status} ${res.statusText}`;
}

async function request(method: string, path: string, body?: unknown) {
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const renewable = !NO_REFRESH.test(url);
  const generation = sessionGeneration;
  let res = await send(method, url, body);
  let renewal: RefreshOutcome | null = null;

  if (res.status === 401 && renewable) {
    // The guards reject before any handler runs, so a 401 means nothing was
    // done and replaying the request once is safe, even for a POST.
    renewal = generation !== sessionGeneration ? 'refreshed' : await refreshSession();
    if (renewal === 'refreshed') res = await send(method, url, body);
  }

  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const { code, message, ...details } = (isJson ? (payload as ApiErrorBody | null)?.error : undefined) ?? {};
    // A ban applies to every request at once; there is nothing left to do
    // with this session.
    if (renewable && res.status === 403 && code === 'ACCOUNT_BANNED') endSession('banned');
    throw new ApiError(res.status, errorMessage(res, renewal, code, message), code, details);
  }

  return payload;
}

export const auth = {
  login: (email: string, password: string) => request('POST', '/auth/login', { email, password }),
  register: (email: string, username: string, password: string) =>
    request('POST', '/auth/register', { email, username, password }),
  me: () => request('GET', '/auth/me'),
  logout: () => request('POST', '/auth/logout'),
  // Re-issues this session's cookies and signs every other session out. A
  // wrong current password is a 400 INVALID_CURRENT_PASSWORD, never a 401.
  changePassword: (currentPassword: string, newPassword: string) =>
    request('POST', '/auth/change-password', { currentPassword, newPassword }),
};

export const rooms = {
  // Battles are 1v1: a private room always seats exactly two players.
  create: () => request('POST', '/rooms', { maxPlayers: 2 }),
  join: (code: string) => request('POST', '/rooms/join', { code }),
  get: (id: string) => request('GET', `/rooms/${id}`),
  leave: (id: string) => request('POST', `/rooms/${id}/leave`),
  invite: (roomId: string, username: string) =>
    request('POST', `/rooms/${roomId}/invite`, { username }),
  // Host only. Idempotent: a repeat returns the match already started.
  start: (code: string) => request('POST', `/rooms/${encodeURIComponent(code)}/start`),
};

export const invitations = {
  mine: () => request('GET', '/invitations/me'),
  accept: (id: string) => request('POST', `/invitations/${id}/accept`),
  decline: (id: string) => request('POST', `/invitations/${id}/decline`),
};

// Five-challenge battle API. GET :id is how the battle page recovers its full
// state after a refresh or reconnect; socket events only trigger a refetch.
export const matches = {
  get: (id: string) => request('GET', `/matches/${id}`),
  challenges: (id: string) => request('GET', `/matches/${id}/challenges`),
  progress: (id: string) => request('GET', `/matches/${id}/progress`),
  active: () => request('GET', '/matches/me/active'),
  // Finished matches, newest first. pageSize is capped at 50 by the API.
  history: (page = 1, pageSize = 10) =>
    request('GET', `/matches/me/history?page=${page}&pageSize=${pageSize}`) as Promise<MatchHistoryPage>,
  // Quick Match only: accept the match found. Both players must accept
  // before its ready deadline or it is cancelled.
  ready: (id: string) => request('POST', `/matches/${id}/ready`) as Promise<ReadyResponse>,
  giveUp: (id: string) => request('POST', `/matches/${id}/give-up`),
  // Public sample tests only - never solves a challenge.
  run: (matchId: string, matchChallengeId: string, code: string) =>
    request('POST', `/matches/${matchId}/challenges/${matchChallengeId}/run`, { code }),
  // Public + hidden tests; only the runner's ACCEPTED verdict solves.
  submit: (matchId: string, matchChallengeId: string, code: string) =>
    request('POST', `/matches/${matchId}/challenges/${matchChallengeId}/submit`, { code }),
};

// Ranked Quick Match queue. While searching, call status() at least every 3 s:
// it doubles as the heartbeat, and a silent searcher is dropped after ~10 s.
export const matchmaking = {
  start: () => request('POST', '/matchmaking/quick') as Promise<MatchmakingResponse>,
  status: () => request('GET', '/matchmaking/quick') as Promise<MatchmakingResponse>,
  cancel: () => request('DELETE', '/matchmaking/quick') as Promise<MatchmakingResponse>,
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  rating: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  totalScore: number;
};

// Public ranked standings (active players only).
export const leaderboard = {
  top: (limit = 50) =>
    request('GET', `/leaderboard?limit=${Math.min(100, Math.max(1, Math.floor(limit)))}`) as Promise<
      LeaderboardEntry[]
    >,
};

/** One published challenge in the public catalogue (GET /challenges). */
export type CatalogueChallenge = {
  id: string;
  slug: string;
  title: string;
  /** Markdown, as authored in the admin console. */
  description: string;
  difficulty: Difficulty;
  tags: string[];
  function: { name: string; parameters: { name: string; type: string }[]; returnType: string };
  limits: { timeLimitMs: number; memoryLimitMb: number; outputLimitKb: number };
  publicTestCount: number;
  publishedAt: string | null;
};

// Published challenges, newest first - the pool battles draw from.
export const challenges = {
  list: () => request('GET', '/challenges') as Promise<{ challenges: CatalogueChallenge[] }>,
};

// Own profile: avatar, competitive stats, location. GET /users/me/profile.
export const profile = {
  me: () => request('GET', '/users/me/profile'),
  update: (payload: Record<string, unknown>) => request('PATCH', '/users/me/profile', payload),
};
