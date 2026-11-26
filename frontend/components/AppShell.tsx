"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import SiteHeader from "./layout/SiteHeader";
import SiteFooter from "./layout/SiteFooter";
import { AuthProvider } from "../hooks/useAuth";
import useAuth from "../hooks/useAuth";
import { ProfileProvider } from "../hooks/useProfile";
import { QuickMatchProvider } from "../hooks/useQuickMatch";
import QuickMatchIndicator from "./app/QuickMatchIndicator";

const authRoutes = ["/login", "/register"];
const guestRoutes = ["/"];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeRoom, loading } = useAuth();
  const isAuth = authRoutes.includes(pathname);
  const isGuest = guestRoutes.includes(pathname);
  // The room and battle pages bring their own full-screen chrome.
  const hideHeader = pathname.startsWith("/rooms/") || pathname.startsWith("/match/");
  const variant = isAuth ? "auth" : user ? "app" : "guest";

  // A player with an open room is sent back to it; once its match has started
  // the room page forwards on to /match/:id. Never redirect away from a match.
  useEffect(() => {
    if (loading || !user || !activeRoom) return;
    if (pathname.startsWith("/rooms/") || pathname.startsWith("/match/")) return;
    router.replace(`/rooms/${activeRoom.id}`);
  }, [loading, user, activeRoom, pathname, router]);

  return (
    <div className="flex min-h-screen flex-col">
      {!hideHeader && <SiteHeader variant={variant} />}
      <div className="flex-1">{children}</div>
      {isGuest && <SiteFooter />}
      {user && <QuickMatchIndicator />}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <QuickMatchProvider>
          <Shell>{children}</Shell>
        </QuickMatchProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
