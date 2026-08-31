'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BriefcaseBusiness, Globe, MessageCircleMore, Trophy, Users } from 'lucide-react';

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
        <footer className="site-footer footer-shell">
          <div className="cc-container footer-inner">
            <div className="footer-brand-block">
              <div className="footer-brand-line">
                <span className="footer-code-mark">&lt;/&gt;</span>
                <span className="footer-brand-name">CodeClash</span>
              </div>

              <p className="footer-tagline">Compete. Code. Improve.</p>

              <p className="footer-copy">
                Real-time JavaScript battles for developers who want to sharpen their skills.
              </p>

              <div className="social-row">
                <button type="button" className="social-badge" aria-label="GitHub"><Globe size={16} strokeWidth={2.1} /></button>
                <button type="button" className="social-badge" aria-label="Community"><Users size={16} strokeWidth={2.1} /></button>
                <button type="button" className="social-badge" aria-label="Career"><BriefcaseBusiness size={16} strokeWidth={2.1} /></button>
                <button type="button" className="social-badge" aria-label="Discord"><MessageCircleMore size={16} strokeWidth={2.1} /></button>
              </div>
            </div>

            <div className="footer-links-column">
              <h3>Product</h3>
              <Link href="/" className="footer-link">Home</Link>
              <Link href="/challenges" className="footer-link">Challenges</Link>
              <Link href="/leaderboard" className="footer-link">Leaderboard</Link>
              <Link href="/how-it-works" className="footer-link">How It Works</Link>
            </div>

            <div className="footer-links-column">
              <h3>Account</h3>
              <Link href="/login" className="footer-link">Login</Link>
              <Link href="/register" className="footer-link">Register</Link>
              <Link href="/lobby" className="footer-link">Lobby</Link>
              <Link href="/community" className="footer-link">Community</Link>
            </div>

            <div className="footer-cta-card">
              <div className="footer-cta-icon"><Trophy size={26} strokeWidth={2.2} /></div>
              <h3>Ready to compete?</h3>
              <p>Join developers worldwide and put your coding skills to the test.</p>
              <Link href="/lobby" className="footer-cta-button">
                Start Competing <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="cc-container footer-bottom">
            <span>© CodeClash</span>
            <div className="footer-legal-links">
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
