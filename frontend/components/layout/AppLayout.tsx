"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export type SideItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export function SideNav({
  items,
  heading,
}: {
  items: SideItem[];
  heading?: string;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {heading && <p className="eyebrow mb-2 px-3">{heading}</p>}
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
              active
                ? "bg-blue/12 text-blue-300 shadow-[inset_2px_0_0_0_var(--color-blue)]"
                : "text-muted hover:bg-white/5 hover:text-fg"
            }`}
          >
            <item.icon size={17} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <span className="ml-auto rounded-md bg-violet/20 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-violet-300">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppLayout({
  sidebar,
  rail,
  children,
}: {
  sidebar: React.ReactNode;
  rail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="cc-container flex flex-col gap-6 py-6 lg:flex-row">
      <aside className="order-2 flex w-full flex-col gap-5 lg:order-none lg:w-[208px] lg:shrink-0">
        {sidebar}
      </aside>

      <main className="order-1 min-w-0 flex-1 lg:order-none">{children}</main>

      {rail && (
        <aside className="order-3 grid w-full gap-5 sm:grid-cols-2 lg:order-none lg:flex lg:w-[320px] lg:shrink-0 lg:grid-cols-1 lg:flex-col">
          {rail}
        </aside>
      )}
    </div>
  );
}
