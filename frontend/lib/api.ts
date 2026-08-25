const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function buildHeaders(isJson = true) {
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(method: string, path: string, body?: any) {
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const opts: any = { method, headers: buildHeaders(body !== undefined) };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    const err: any = new Error(`API ${res.status} ${res.statusText}: ${text}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const auth = {
  login: (email: string, password: string) => request('POST', '/auth/login', { email, password }),
  register: (email: string, username: string, password: string) => request('POST', '/auth/register', { email, username, password }),
  me: () => request('GET', '/auth/me'),
};

export const rooms = {
  list: () => request('GET', '/rooms'),
  create: (maxPlayers = 2) => request('POST', '/rooms', { maxPlayers }),
  join: (code: string) => request('POST', '/rooms/join', { code }),
  get: (id: string) => request('GET', `/rooms/${id}`),
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
