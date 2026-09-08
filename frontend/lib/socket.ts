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
    auth: { token: token || (typeof window !== 'undefined' ? localStorage.getItem('token') : undefined) },
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
