const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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
  invite: (roomId: string, username: string) =>
    request('POST', `/rooms/${roomId}/invite`, { username }),
};

export const invitations = {
  mine: () => request('GET', '/invitations/me'),
  accept: (id: string) => request('POST', `/invitations/${id}/accept`),
  decline: (id: string) => request('POST', `/invitations/${id}/decline`),
};

export const matches = {
  start: (roomId: string) => request('POST', `/matches/start/${roomId}`),
  get: (id: string) => request('GET', `/matches/${id}`),
};

export const rounds = {
  run: (roundId: string, code: string) => request('POST', `/rounds/${roundId}/run`, { code }),
  submit: (roundId: string, code: string) => request('POST', `/rounds/${roundId}/submit`, { code }),
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
