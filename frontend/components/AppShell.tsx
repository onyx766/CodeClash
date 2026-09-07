"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "./layout/SiteHeader";
import SiteFooter from "./layout/SiteFooter";
import { AuthProvider } from "../hooks/useAuth";
import useAuth from "../hooks/useAuth";

const authRoutes = ["/login", "/register"];
const guestRoutes = ["/"];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAuth = authRoutes.includes(pathname);
  const isGuest = guestRoutes.includes(pathname);
  const variant = isAuth ? "auth" : user ? "app" : "guest";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant={variant} />
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
