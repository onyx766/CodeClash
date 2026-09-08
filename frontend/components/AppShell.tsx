"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import SiteHeader from "./layout/SiteHeader";
import SiteFooter from "./layout/SiteFooter";
import { AuthProvider } from "../hooks/useAuth";
import useAuth from "../hooks/useAuth";

const authRoutes = ["/login", "/register"];
const guestRoutes = ["/"];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeRoom, loading } = useAuth();
  const isAuth = authRoutes.includes(pathname);
  const isGuest = guestRoutes.includes(pathname);
  const hideHeader = pathname.startsWith("/rooms/");
  const variant = isAuth ? "auth" : user ? "app" : "guest";

  useEffect(() => {
    if (loading || !user || !activeRoom) return;
    if (pathname.startsWith("/rooms/")) return;
    router.replace(`/rooms/${activeRoom.id}`);
  }, [loading, user, activeRoom, pathname, router]);

  return (
    <div className="flex min-h-screen flex-col">
      {!hideHeader && <SiteHeader variant={variant} />}
      <div className="flex-1">{children}</div>
      {isGuest && <SiteFooter />}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
