'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/challenges', label: 'Challenges' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/community', label: 'Community' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideFooter = pathname === '/login' || pathname === '/register';

  return (
    <>
      <div className="w-full">
        <header className="main-nav">
          <div className="cc-container topbar-shell">
            <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
              CodeClash
            </Link>

            <nav className="nav-links" aria-label="Main navigation">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="nav-right">
              <Link href="/login" className="nav-login">
                Login
              </Link>
              <Link href="/lobby" className="btn-primary header-cta">
                Start Competing
              </Link>
            </div>
          </div>
        </header>
      </div>

      <main className="flex-1 auth-main">{children}</main>

      {!hideFooter && (
        <footer className="site-footer">
          <div className="cc-container" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div className="font-semibold">CodeClash</div>
              <div className="muted">Compete. Code. Improve.</div>
            </div>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Link href="/" className="nav-link">Home</Link>
                <Link href="/lobby" className="nav-link">Lobby</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
                <Link href="/challenges" className="nav-link">Challenges</Link>
              </div>
            </div>
            <div className="muted">© CodeClash</div>
          </div>
        </footer>
      )}
    </>
  );
}
