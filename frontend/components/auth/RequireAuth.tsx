"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "../../hooks/useAuth";
import { authHref, currentPathWithQuery, isAuthPage } from "../../lib/navigation";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionExpired } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || user) return;
    // Already on the way to the login page (the session just expired).
    if (isAuthPage(window.location.pathname)) return;
    // Keep the query string: invite links (/lobby?code=...) must survive sign-in.
    router.replace(authHref("/login", currentPathWithQuery(), { expired: sessionExpired }));
  }, [loading, user, sessionExpired, router]);

  if (loading || !user) {
    return (
      <div className="cc-container flex min-h-[50vh] items-center justify-center">
        <p className="text-[13px] text-dim">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
