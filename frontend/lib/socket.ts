import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// See lib/api.ts getApiBase() for why this derives from window.location
// instead of trusting a hardcoded env var.
function getWsUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}

export function getSocket(token?: string) {
  if (socket) return socket;
  socket = io(getWsUrl(), {
    // Auth is a cookie set by the API (httpOnly, so it isn't readable here) -
    // withCredentials makes the browser attach it to the handshake request,
    // same as fetch's credentials: 'include' in lib/api.ts. `token` stays as
    // an explicit override for non-browser/test callers.
    withCredentials: true,
    auth: token ? { token } : undefined,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
