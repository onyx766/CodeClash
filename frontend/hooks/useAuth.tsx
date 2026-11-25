"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, onSessionExpired, onSessionRefreshed } from "../lib/api";
import { authHref, currentPathWithQuery, isAuthPage } from "../lib/navigation";
import { connectSocket, disconnectSocket, recreateSocket } from "../lib/socket";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
};

export type ActiveRoom = {
  id: string;
  code: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  activeRoom: ActiveRoom | null;
  loading: boolean;
  /** The last session ended because it could not be renewed (not a logout). */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<{ user: AuthUser; activeRoom: ActiveRoom | null }>;
  register: (email: string, username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Changes the password; every other session of the account is signed out. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearActiveRoom: () => void;
  /** Re-reads the player's open room from the server, e.g. after a match ended. */
  refreshActiveRoom: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Read by the session-expiry listener, which outlives any one render.
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    auth
      .me()
      .then((res: { user: AuthUser; activeRoom?: ActiveRoom | null }) => {
        if (!cancelled) {
          setUser(res.user);
          setActiveRoom(res.activeRoom ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setActiveRoom(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // One socket per signed-in player: a fresh one whenever the user changes
  // (so nothing bound to the previous identity survives), none when signed out.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId) connectSocket(userId);
    else disconnectSocket();
  }, [userId]);

  // The server authenticates a socket only at its handshake, so reconnect
  // with the renewed cookie after every refresh.
  useEffect(() => onSessionRefreshed(recreateSocket), []);

  // The API client could not renew the session (refresh refused or account
  // banned): sign out here and send the player to the login page, which
  // brings them back to where they were.
  useEffect(
    () =>
      onSessionExpired(() => {
        // A guest's failed /auth/me ends nothing.
        if (!userRef.current) return;
        userRef.current = null;
        setUser(null);
        setActiveRoom(null);
        setSessionExpired(true);
        if (!isAuthPage(window.location.pathname)) {
          router.replace(authHref("/login", currentPathWithQuery(), { expired: true }));
        }
      }),
    [router],
  );

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login(email, password);
    const nextActiveRoom = (res.activeRoom ?? null) as ActiveRoom | null;
    setUser(res.user);
    setActiveRoom(nextActiveRoom);
    setSessionExpired(false);
    return { user: res.user as AuthUser, activeRoom: nextActiveRoom };
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const res = await auth.register(email, username, password);
    setUser(res.user);
    setActiveRoom(null);
    setSessionExpired(false);
    return res.user as AuthUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      // The cookies may already be gone - sign out locally regardless.
    }
    setUser(null);
    setActiveRoom(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const owner = userRef.current?.id ?? null;
    // The API closes every socket of the account - this tab's included - and
    // revokes the old cookies. Close ours first: its recovery would otherwise
    // race the response and try to renew the session with the revoked
    // refresh cookie, which signs the player out. Reconnect afterwards, with
    // the cookies the response re-issued (or the old ones, if it failed).
    disconnectSocket();
    try {
      await auth.changePassword(currentPassword, newPassword);
    } finally {
      if (owner && userRef.current?.id === owner) connectSocket(owner);
    }
  }, []);

  const clearActiveRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  const refreshActiveRoom = useCallback(async () => {
    try {
      const res = await auth.me();
      setActiveRoom((res.activeRoom ?? null) as ActiveRoom | null);
    } catch {
      // Keep what we have; a failed read must not drop the player's room.
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      activeRoom,
      loading,
      sessionExpired,
      login,
      register,
      logout,
      changePassword,
      clearActiveRoom,
      refreshActiveRoom,
    }),
    [
      user,
      activeRoom,
      loading,
      sessionExpired,
      login,
      register,
      logout,
      changePassword,
      clearActiveRoom,
      refreshActiveRoom,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
