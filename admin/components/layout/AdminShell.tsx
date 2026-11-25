"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import { usePlayerAppUrl } from "../../hooks/usePlayerAppUrl";
import { Button, cx } from "../ui/Primitives";
import {
  IconAnalytics,
  IconAward,
  IconChevronDown,
  IconDashboard,
  IconExternal,
  IconFile,
  IconLogo,
  IconLogout,
  IconMatches,
  IconReport,
  IconRooms,
  IconSearch,
  IconSettings,
  IconShop,
  IconSparkles,
  IconTrophy,
  IconUsers,
} from "../ui/Icons";

const NAV = [
  { href: "/", label: "Dashboard", icon: IconDashboard },
  { href: "/users", label: "Users", icon: IconUsers },
  { href: "/challenges", label: "Challenges", icon: IconTrophy },
] as const;

/**
 * Planned sections. Each route exists and says plainly that it is not built,
 * but they are kept apart and muted so nobody mistakes them for working tools.
 */
const COMING_SOON = [
  { href: "/matches", label: "Matches", icon: IconMatches },
  { href: "/rooms", label: "Rooms", icon: IconRooms },
  { href: "/submissions", label: "Submissions", icon: IconFile },
  { href: "/leaderboard", label: "Leaderboard", icon: IconAnalytics },
  { href: "/shop", label: "Shop", icon: IconShop },
  { href: "/achievements", label: "Achievements", icon: IconAward },
  { href: "/reports", label: "Reports", icon: IconReport },
  { href: "/settings", label: "Settings", icon: IconSettings },
] as const;

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

/**
 * Topbar search. Submitting routes to whichever section can actually search:
 * the challenges list while you are in Challenges, otherwise the user list.
 * Deliberately not a fake omnibox over sections that have no search endpoint.
 */
function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const target = pathname.startsWith("/challenges") ? "/challenges" : "/users";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="hidden min-w-0 flex-1 md:block md:max-w-[520px]"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        router.push(
          trimmed ? `${target}?search=${encodeURIComponent(trimmed)}` : target,
        );
      }}
    >
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
          <IconSearch size={15} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            target === "/challenges"
              ? "Search challenges…"
              : "Search users by username, email, or ID…"
          }
          aria-label="Search"
          className="input h-9 pr-16 pl-9 text-[12.5px]"
        />
        <kbd className="mono pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[10px] text-dim">
          ⌘K
        </kbd>
      </div>
    </form>
  );
}

/**
 * Console chrome: fixed sidebar, sticky topbar, scrolling content column.
 * Matches the admin dashboard design - dark navy, blue/violet accents, dense.
 */
export function AdminShell({
  children,
  breadcrumbs,
}: {
  children: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAdminAuth();
  const playerAppUrl = usePlayerAppUrl();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-full">
      {/* ---------------- sidebar ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--shell-sidebar)] flex-col border-r border-line bg-[rgba(7,11,24,0.92)] backdrop-blur lg:flex">
        <Link
          href="/"
          className="flex h-[var(--shell-topbar)] items-center gap-2.5 border-b border-line px-5"
        >
          <IconLogo size={26} />
          <span className="text-[15px] font-bold tracking-tight">
            CodeClash
            <span className="ml-1.5 font-semibold text-dim">Admin</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cx(
                      "relative flex items-center gap-3 rounded-[9px] px-3 py-2 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-blue/12 text-blue-soft"
                        : "text-muted hover:bg-panel-2 hover:text-fg",
                    )}
                  >
                    {active ? (
                      <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue" />
                    ) : null}
                    <Icon size={17} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="eyebrow mt-6 mb-1.5 px-3 text-faint">Coming soon</p>
          <ul className="space-y-0.5">
            {COMING_SOON.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cx(
                      "flex items-center gap-3 rounded-[9px] px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                      active
                        ? "bg-panel-2 text-muted"
                        : "text-faint hover:bg-panel-2/60 hover:text-dim",
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-[10px] border border-line bg-panel-2/60 p-3">
            <div className="flex items-center gap-2">
              <IconSparkles size={15} className="text-violet" />
              <span className="text-[12px] font-semibold text-fg">CodeClash</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-dim">
              Competitive coding for everyone
            </p>
          </div>
        </div>
      </aside>

      {/* ---------------- main column ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[var(--shell-sidebar)]">
        <header className="sticky top-0 z-20 flex h-[var(--shell-topbar)] items-center gap-4 border-b border-line bg-[rgba(7,11,24,0.85)] px-4 backdrop-blur sm:px-6">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <IconLogo size={24} />
            <span className="text-[14px] font-bold">Admin</span>
          </Link>

          <GlobalSearch />

          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-1.5 text-[12px] text-dim xl:flex"
          >
            {(breadcrumbs ?? []).map((crumb, index) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {index > 0 ? <span className="text-faint">/</span> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-fg">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-fg">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <a
              href={playerAppUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-2 rounded-[9px] border border-line px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:border-panel-3 hover:text-fg sm:inline-flex"
            >
              <IconExternal size={14} />
              Main site
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-[9px] border border-line py-1 pr-2 pl-1.5 transition-colors hover:border-panel-3"
              >
                <span className="grid size-7 place-items-center rounded-[7px] bg-gradient-to-br from-blue to-violet text-[11px] font-bold text-white">
                  {initials(user?.username ?? "AD")}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[12px] font-semibold text-fg">
                    {user?.username ?? "Administrator"}
                  </span>
                  <span className="block text-[10px] text-dim">
                    {user?.role ?? ""}
                  </span>
                </span>
                <IconChevronDown size={14} className="text-dim" />
              </button>

              {menuOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="panel absolute right-0 z-20 mt-2 w-56 overflow-hidden p-1.5"
                  >
                    <div className="px-2.5 py-2">
                      <p className="truncate text-[12px] font-semibold text-fg">
                        {user?.username}
                      </p>
                      <p className="truncate text-[11px] text-dim">{user?.email}</p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      icon={<IconLogout size={15} />}
                      onClick={async () => {
                        setMenuOpen(false);
                        await logout();
                        router.replace("/login");
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
