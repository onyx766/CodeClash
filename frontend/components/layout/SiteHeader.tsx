"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, User as UserIcon, X } from "lucide-react";
import Logo from "../ui/Logo";
import { Avatar, avatarForUserId } from "../ui/Bits";
import useAuth from "../../hooks/useAuth";
import useProfile from "../../hooks/useProfile";

const AUTH_ONLY_ROUTES = new Set(["/lobby", "/challenges"]);

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
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profileUser } = useProfile();
  const avatarSrc = profileUser?.avatarUrl || avatarForUserId(user?.id ?? "guest");
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const nav =
    variant === "auth"
      ? mainNav.slice(0, 3)
      : variant === "guest"
        ? mainNav.filter((item) => !AUTH_ONLY_ROUTES.has(item.href))
        : mainNav;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

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

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-white/5"
                >
                  <Avatar src={avatarSrc} alt={user?.username ?? "Account"} size={34} online />
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-[13px] font-semibold">{user?.username}</span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`hidden text-dim transition-transform sm:block ${menuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-xl border border-line bg-surface/95 shadow-xl backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
                      <Avatar src={avatarSrc} alt={user?.username ?? "Account"} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">{user?.username}</span>
                        <span className="block truncate text-[11px] text-dim">{user?.email}</span>
                      </span>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-white/5 hover:text-fg"
                      role="menuitem"
                    >
                      <UserIcon size={15} /> View Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-300 transition-colors hover:bg-rose/10"
                      role="menuitem"
                    >
                      <LogOut size={15} /> Log out
                    </button>
                  </div>
                )}
              </div>
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
          {nav.map((item) => (
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
          {variant === "app" ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void handleLogout();
              }}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted"
            >
              Log out
            </button>
          ) : (
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
