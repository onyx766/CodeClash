"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "./layout/SiteHeader";
import SiteFooter from "./layout/SiteFooter";

const authRoutes = ["/login", "/register"];
const guestRoutes = ["/"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = authRoutes.includes(pathname);
  const isGuest = guestRoutes.includes(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant={isAuth ? "auth" : isGuest ? "guest" : "app"} />
      <div className="flex-1">{children}</div>
      {isGuest && <SiteFooter />}
    </div>
  );
}
