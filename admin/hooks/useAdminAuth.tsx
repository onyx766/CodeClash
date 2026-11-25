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
import { auth, onSessionExpired } from "../lib/api";
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
  /** True when a signed-in session ended because it could not be renewed. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

const isPrivileged = (user: AuthUser | null) =>
  user?.role === "ADMIN" || user?.role === "MASTER";

/**
 * Resolves the current session's user, or null when signed out. An expired
 * access cookie is renewed by the API client itself, so a 401 that still comes
 * back here means there is no session (the normal state on the login page).
 */
async function fetchSessionUser(): Promise<AuthUser | null> {
  try {
    const response = await auth.me();
    return (response as { user: AuthUser }).user ?? null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

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

  // The API client could not renew the session (refresh cookie expired or
  // revoked, or the account was banned): sign the console out. The route
  // guards then send the browser to /login.
  useEffect(
    () =>
      onSessionExpired(() => {
        if (user) setSessionExpired(true);
        setUser(null);
      }),
    [user],
  );

  const value = useMemo<AdminAuthValue>(
    () => ({
      user,
      loading,
      isAdmin: isPrivileged(user),
      sessionExpired,
      login: async (email, password) => {
        await auth.login(email, password);
        const response = await auth.me();
        const nextUser = (response as { user: AuthUser }).user;
        setUser(nextUser ?? null);
        setSessionExpired(false);
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
    [user, loading, sessionExpired, load],
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
 * Where to send a signed-out visitor: /login, remembering the page they were
 * on so signing in returns them there.
 */
function loginRedirect(): string {
  const here = window.location.pathname + window.location.search;
  return here === "/" || here.startsWith("/login")
    ? "/login"
    : `/login?next=${encodeURIComponent(here)}`;
}

/**
 * The in-console page to open after signing in: the `next` parameter when it
 * is a same-origin path, otherwise null. Anything else (an absolute URL, a
 * protocol-relative `//host`) is ignored so the login page cannot be used as
 * an open redirect.
 */
export function postLoginPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (next.startsWith("/\\") || next.startsWith("/login")) return null;
  return next;
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
    if (!user || !isAdmin) router.replace(loginRedirect());
  }, [loading, user, isAdmin, router]);

  return { user, loading, isAdmin };
}
