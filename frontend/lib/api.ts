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

type ApiErrorBody = { success?: false; error?: { code?: string; message?: string } };

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method: string, path: string, body?: unknown) {
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const errBody = (isJson ? (payload as ApiErrorBody) : null) ?? {};
    const message = errBody.error?.message || `API ${res.status} ${res.statusText}`;
    throw new ApiError(res.status, message, errBody.error?.code);
  }

  return payload;
}

export const auth = {
  login: (email: string, password: string) => request('POST', '/auth/login', { email, password }),
  register: (email: string, username: string, password: string) =>
    request('POST', '/auth/register', { email, username, password }),
  me: () => request('GET', '/auth/me'),
  logout: () => request('POST', '/auth/logout'),
  refresh: () => request('POST', '/auth/refresh'),
};

export const rooms = {
  list: () => request('GET', '/rooms'),
  create: (maxPlayers = 2) => request('POST', '/rooms', { maxPlayers }),
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
  history: (page = 1, pageSize = 10) =>
    request('GET', `/matches/me/history?page=${page}&pageSize=${pageSize}`),
  ready: (id: string) => request('POST', `/matches/${id}/ready`),
  giveUp: (id: string) => request('POST', `/matches/${id}/give-up`),
  // Public sample tests only - never solves a challenge.
  run: (matchId: string, matchChallengeId: string, code: string) =>
    request('POST', `/matches/${matchId}/challenges/${matchChallengeId}/run`, { code }),
  // Public + hidden tests; only the runner's ACCEPTED verdict solves.
  submit: (matchId: string, matchChallengeId: string, code: string) =>
    request('POST', `/matches/${matchId}/challenges/${matchChallengeId}/submit`, { code }),
};

// Own profile: avatar, competitive stats, location. GET /users/me/profile.
export const profile = {
  me: () => request('GET', '/users/me/profile'),
  update: (payload: Record<string, unknown>) => request('PATCH', '/users/me/profile', payload),
};

export const infra = {
  runnerReady: () => request('GET', '/runner/ready').catch(() => ({ ready: false })),
  runnerHealth: () => request('GET', '/runner/health').catch(() => ({ ok: false })),
};

export const infraStatus = {
  status: () => request('GET', '/runner/status').catch(() => ({ workers: 0, queued: 0, processing: 0 })),
  jobs: () => request('GET', '/runner/jobs').catch(() => ({ items: [] })),
  jobDetails: async (jobId: string) => {
    try { return await request('GET', `/jobs/${jobId}`); } catch (e) {
      try { return await request('GET', `/runner/job/${jobId}`); } catch (e2) { return { jobId, items: [] }; }
    }
  },
};

export default { request };
