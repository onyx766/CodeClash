"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, ChevronDown, Menu, Trophy, X } from "lucide-react";
import Logo from "../ui/Logo";
import { Avatar } from "../ui/Bits";
import { currentUser } from "../../lib/demo";

export const mainNav = [
  { href: "/lobby", label: "Lobby" },
  { href: "/challenges", label: "Challenges" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/community", label: "Community" },
];

export default function SiteHeader({
  variant = "guest",
}: {
  variant?: "guest" | "app" | "auth";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = variant === "auth" ? mainNav.slice(0, 3) : mainNav;

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/85 backdrop-blur-xl">
      <div className="cc-container flex h-[68px] items-center gap-4">
        <Logo />

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-blue/12 text-blue-300"
                    : "text-muted hover:bg-white/5 hover:text-fg"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-4">
          {variant === "app" ? (
            <>
              <button
                type="button"
                aria-label="Notifications"
                className="relative hidden h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-fg sm:inline-flex"
              >
                <Bell size={18} strokeWidth={2} />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose text-[9.5px] font-bold text-white ring-2 ring-surface">
                  2
                </span>
              </button>

              <button
                type="button"
                className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-white/5"
              >
                <Avatar src={currentUser.avatar} alt={currentUser.name} size={34} online />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[13px] font-semibold">{currentUser.name}</span>
                  <span className="flex items-center gap-1 text-[11.5px] font-semibold text-amber">
                    <Trophy size={11} strokeWidth={2.4} />
                    {currentUser.rating}
                  </span>
                </span>
                <ChevronDown size={16} className="hidden text-dim sm:block" />
              </button>
            </>
          ) : (
            <>
              {variant === "guest" && (
                <Link
                  href="/login"
                  className="hidden rounded-lg px-3.5 py-2 text-[13.5px] font-medium text-muted transition-colors hover:text-fg sm:block"
                >
                  Log in
                </Link>
              )}
              <Link href="/register" className="btn btn-blue !px-5">
                Sign Up
              </Link>
            </>
          )}

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-fg lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="cc-container flex flex-col gap-1 border-t border-line/80 py-3 lg:hidden">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                pathname === item.href ? "bg-blue/12 text-blue-300" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {variant !== "app" && (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted"
            >
              Log in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
