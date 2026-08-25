import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string) {
  if (socket) return socket;
  socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
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
