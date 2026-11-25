import { io, Socket } from 'socket.io-client';
import { refreshSession } from './api';

// See lib/api.ts getApiBase() for why this derives from window.location
// instead of trusting a hardcoded env var.
function getWsUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}

/*
 * One socket per signed-in player. The server authenticates a socket once, at
 * the handshake, from the access-token cookie, and keeps that identity for the
 * socket's whole life. So the AuthProvider creates a fresh socket whenever the
 * signed-in user changes, drops it on logout, and recreates it after every
 * session refresh. Components read the current instance with useSocket() and
 * re-attach their listeners when it changes.
 */

let socket: Socket | null = null;
let ownerId: string | null = null;
const subscribers = new Set<() => void>();

let failures = 0;
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let stableTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  subscribers.forEach((subscriber) => subscriber());
}

export function subscribeSocket(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

/** The signed-in player's socket, or null when nobody is signed in. */
export function getSocket(): Socket | null {
  return socket;
}

function clearTimers() {
  if (recoveryTimer) clearTimeout(recoveryTimer);
  if (stableTimer) clearTimeout(stableTimer);
  recoveryTimer = null;
  stableTimer = null;
}

function drop() {
  clearTimers();
  const old = socket;
  socket = null;
  if (old) {
    // Disconnect first, so subscribers still hear "disconnect".
    old.disconnect();
    old.removeAllListeners();
  }
}

function create(userId: string) {
  const s = io(getWsUrl(), {
    // Auth is the httpOnly cookie set by the API (not readable here);
    // withCredentials makes the browser attach it to the handshake, same as
    // fetch's credentials: 'include' in lib/api.ts.
    withCredentials: true,
    // Never reuse a connection - and the identity bound to it - from an
    // earlier socket.
    forceNew: true,
  });
  s.on('connect', () => {
    if (stableTimer) clearTimeout(stableTimer);
    // A connection the server keeps was authenticated: reset the backoff.
    stableTimer = setTimeout(() => {
      if (socket === s && s.connected) failures = 0;
    }, 10_000);
  });
  s.on('disconnect', (reason) => {
    if (socket !== s) return;
    if (stableTimer) clearTimeout(stableTimer);
    stableTimer = null;
    // The server only disconnects a socket itself when its handshake was not
    // authenticated (missing or expired access cookie, revoked session, ban),
    // and socket.io never retries that on its own.
    if (reason === 'io server disconnect') scheduleRecovery(s);
  });
  socket = s;
  ownerId = userId;
}

function scheduleRecovery(s: Socket) {
  if (recoveryTimer) return;
  // Straight away the first time - an expired access token is the usual
  // cause - then back off, so a server that keeps refusing is not hammered.
  const delay = failures === 0 ? 0 : Math.min(30_000, 1_000 * 2 ** (failures - 1));
  failures += 1;
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    if (socket !== s) return;
    void refreshSession().then((outcome) => {
      // Already recreated by the session-refresh listener, or signed out.
      if (socket !== s) return;
      if (outcome === 'refreshed') recreateSocket();
      else if (outcome === 'unavailable') scheduleRecovery(s);
      // 'rejected': the session is over and the AuthProvider signs out.
    });
  }, delay);
}

/** Makes sure `userId` has a socket: creates one, or replaces another user's. */
export function connectSocket(userId: string) {
  if (socket && ownerId === userId) {
    if (!socket.active && !recoveryTimer) socket.connect();
    return;
  }
  drop();
  failures = 0;
  create(userId);
  notify();
}

/** New socket for the same player, so the handshake carries the current cookie. */
export function recreateSocket() {
  if (!ownerId) return;
  const owner = ownerId;
  drop();
  create(owner);
  notify();
}

/** Signed out: close the socket and forget whose it was. */
export function disconnectSocket() {
  if (!socket && !ownerId) return;
  drop();
  ownerId = null;
  failures = 0;
  notify();
}

/**
 * Runs `onConnect` now if `s` is connected, and again after every reconnect
 * (with `reconnected` set). Returns a function that stops listening.
 */
export function onEveryConnect(s: Socket, onConnect: (reconnected: boolean) => void): () => void {
  const handler = () => onConnect(true);
  if (s.connected) onConnect(false);
  s.on('connect', handler);
  return () => {
    s.off('connect', handler);
  };
}

export type ChannelAck = { ok?: boolean; error?: string };

/**
 * Subscribes to a server channel (room:join, match:join) and reports the ack.
 * The server binds a socket to its user asynchronously after the handshake,
 * so a join sent the moment the socket connects can be refused with
 * INVALID_REQUEST; that is retried a few times. Returns a function that stops
 * any further retries.
 */
export function joinChannel(
  s: Socket,
  event: string,
  payload: Record<string, unknown>,
  onAck?: (ack: ChannelAck) => void,
): () => void {
  let stopped = false;
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const send = () => {
    s.timeout(10_000).emit(event, payload, (err: Error | null, ack?: ChannelAck) => {
      if (stopped) return;
      if (!err && ack?.error === 'INVALID_REQUEST' && attempt < 5 && s.connected) {
        attempt += 1;
        retry = setTimeout(send, 200 * attempt);
        return;
      }
      onAck?.(err ? { ok: false, error: 'TIMEOUT' } : (ack ?? { ok: false }));
    });
  };
  send();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
  };
}
