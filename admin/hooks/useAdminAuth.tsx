"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ApiError, auth } from "../lib/api";
import type { AuthUser } from "../lib/types";

/**
 * Session state for the admin console.
 *
 * This is presentation only. The role held here decides which shell to render;
 * it never decides what the caller may do. Every admin route on the backend
 * re-derives the role from the httpOnly JWT and refuses anything below ADMIN,
 * so editing this value in a browser buys nothing.
 */

interface AdminAuthValue {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

const isPrivileged = (user: AuthUser | null) =>
  user?.role === "ADMIN" || user?.role === "MASTER";

/**
 * Resolves the current session's user, or null when signed out. A 401 is the
 * normal state on the login page; one silent refresh covers an expired access
 * cookie.
 */
async function fetchSessionUser(): Promise<AuthUser | null> {
  try {
    const response = await auth.me();
    return (response as { user: AuthUser }).user ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      try {
        await auth.refresh();
        const retry = await auth.me();
        return (retry as { user: AuthUser }).user ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await fetchSessionUser();
    setUser(user);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // State is only set from the promise callback, never synchronously in the
    // effect body.
    fetchSessionUser().then((sessionUser) => {
      if (cancelled) return;
      setUser(sessionUser);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AdminAuthValue>(
    () => ({
      user,
      loading,
      isAdmin: isPrivileged(user),
      login: async (email, password) => {
        await auth.login(email, password);
        const response = await auth.me();
        const nextUser = (response as { user: AuthUser }).user;
        setUser(nextUser ?? null);
        return nextUser;
      },
      logout: async () => {
        try {
          await auth.logout();
        } finally {
          setUser(null);
        }
      },
      refresh: load,
    }),
    [user, loading, load],
  );

  return (
    <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  }
  return context;
}

/**
 * Redirects to /login unless the session belongs to an ADMIN or MASTER.
 * Convenience only - the API is what actually enforces this.
 */
export function useRequireAdmin() {
  const { user, loading, isAdmin } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) router.replace("/login");
  }, [loading, user, isAdmin, router]);

  return { user, loading, isAdmin };
}
