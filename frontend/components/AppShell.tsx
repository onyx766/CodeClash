'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, MessageCircle, Trophy, X, Zap } from 'lucide-react';
import CodeClashLogo from './CodeClashLogo';
import { GitHubIcon, LinkedInIcon } from './icons/SocialIcons';

const navItems = [
  { href: '/challenges', label: 'Challenges' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/community', label: 'Community' },
];

const productLinks = [
  { href: '/challenges', label: 'Challenges' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/#features', label: 'Features' },
];

const communityLinks = [
  { href: '/community', label: 'Discussion' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
];

const resourceLinks = [
  { href: '/docs', label: 'Docs' },
  { href: '/faq', label: 'FAQ' },
  { href: '/rules', label: 'Rules' },
  { href: '/support', label: 'Support' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideFooter = pathname === '/login' || pathname === '/register';
  const isHome = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="main-nav">
        <div className="cc-container topbar-shell">
          <CodeClashLogo />

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
            <button
              type="button"
              className="nav-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="mobile-nav-panel">
            <nav className="mobile-nav-links" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="mobile-nav-link"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/login" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                Login
              </Link>
              <Link
                href="/lobby"
                className="btn-primary mobile-nav-cta"
                onClick={() => setMenuOpen(false)}
              >
                Start Competing
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className={`flex-1 ${isHome || hideFooter ? '' : 'auth-main'}`}>{children}</main>

      {!hideFooter && (
        <footer className="site-footer">
          <div className="cc-container footer-inner">
            <div className="footer-brand-block">
              <CodeClashLogo href="/" variant="light" className="footer-logo" />
              <p className="footer-tagline">Compete. Code. Improve.</p>
              <p className="footer-copy">
                Real-time JavaScript battles for developers who want to sharpen their skills and
                climb the global leaderboard.
              </p>
              <div className="social-row">
                <a href="https://twitter.com" className="social-badge" aria-label="Twitter">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a href="https://github.com" className="social-badge" aria-label="GitHub">
                  <GitHubIcon className="social-brand-icon" />
                </a>
                <a href="https://discord.com" className="social-badge" aria-label="Discord">
                  <MessageCircle size={16} strokeWidth={2.1} />
                </a>
                <a href="https://linkedin.com" className="social-badge" aria-label="LinkedIn">
                  <LinkedInIcon className="social-brand-icon" />
                </a>
              </div>
            </div>

            <div className="footer-links-column">
              <h3>Product</h3>
              {productLinks.map((link) => (
                <Link key={link.href} href={link.href} className="footer-link">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="footer-links-column">
              <h3>Community</h3>
              {communityLinks.map((link) => (
                <Link key={link.href} href={link.href} className="footer-link">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="footer-links-column">
              <h3>Resources</h3>
              {resourceLinks.map((link) => (
                <Link key={link.href} href={link.href} className="footer-link">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="footer-cta-card">
              <div className="footer-cta-icon">
                <Trophy size={26} strokeWidth={2.2} />
              </div>
              <h3>Join the arena today</h3>
              <p>Start competing in real-time JavaScript battles and prove your skills.</p>
              <Link href="/lobby" className="footer-cta-button">
                <Zap size={18} strokeWidth={2.2} />
                Start Competing
              </Link>
            </div>
          </div>

          <div className="cc-container footer-bottom">
            <span>© 2024 CodeClash. All rights reserved.</span>
            <div className="footer-legal-links">
              <Link href="/terms">Terms of Service</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/conduct">Code of Conduct</Link>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
