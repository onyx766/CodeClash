"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../lib/api";

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
  login: (email: string, password: string) => Promise<{ user: AuthUser; activeRoom: ActiveRoom | null }>;
  register: (email: string, username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  clearActiveRoom: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [loading, setLoading] = useState(true);

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

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login(email, password);
    const nextActiveRoom = (res.activeRoom ?? null) as ActiveRoom | null;
    setUser(res.user);
    setActiveRoom(nextActiveRoom);
    return { user: res.user as AuthUser, activeRoom: nextActiveRoom };
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const res = await auth.register(email, username, password);
    setUser(res.user);
    setActiveRoom(null);
    return res.user as AuthUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      setUser(null);
      setActiveRoom(null);
    }
  }, []);

  const clearActiveRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  const value = useMemo(
    () => ({ user, activeRoom, loading, login, register, logout, clearActiveRoom }),
    [user, activeRoom, loading, login, register, logout, clearActiveRoom],
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
