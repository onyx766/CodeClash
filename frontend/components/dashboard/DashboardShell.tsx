'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  Flame,
  History,
  LayoutGrid,
  Settings,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import CodeClashLogo from '../CodeClashLogo';

const topNavItems = [
  { href: '/lobby', label: 'Lobby' },
  { href: '/challenges', label: 'Challenges' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/community', label: 'Community' },
];

const sidebarItems = [
  { href: '/lobby', label: 'Lobby', icon: LayoutGrid },
  { href: '/lobby', label: 'Rooms', icon: Users },
  { href: '/lobby', label: 'Match History', icon: History },
  { href: '/community', label: 'Friends', icon: UserPlus },
  { href: '/lobby', label: 'Tournaments', icon: Trophy, badge: 'NEW' },
  { href: '/lobby', label: 'Settings', icon: Settings },
];

type DashboardShellProps = {
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
};

export default function DashboardShell({ children, rightSidebar }: DashboardShellProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/lobby') return pathname === '/lobby';
    return pathname.startsWith(href);
  };

  return (
    <div className="dashboard-layout">
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-inner">
          <CodeClashLogo href="/lobby" variant="light" size="sm" />

          <nav className="dashboard-topnav" aria-label="Main navigation">
            {topNavItems.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`dashboard-topnav-link${isActive(item.href) ? ' active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="dashboard-topbar-actions">
            <button type="button" className="dashboard-notif-btn" aria-label="Notifications">
              <Bell size={18} strokeWidth={2} />
              <span className="dashboard-notif-badge">2</span>
            </button>
            <button type="button" className="dashboard-user-menu">
              <span className="dashboard-avatar">T</span>
              <span className="dashboard-user-name">Tyler</span>
              <span className="dashboard-user-rating">
                <Trophy size={12} strokeWidth={2.2} />
                1850
              </span>
              <ChevronDown size={14} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className="dashboard-sidebar">
          <nav className="dashboard-sidebar-nav">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = item.label === 'Lobby' ? pathname === '/lobby' : false;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`dashboard-sidebar-link${active ? ' active' : ''}`}
                >
                  <Icon size={18} strokeWidth={2} />
                  <span>{item.label}</span>
                  {item.badge && <span className="sidebar-badge">{item.badge}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="dashboard-sidebar-stats">
            <div className="sidebar-level">
              <div className="sidebar-level-header">
                <span>Level 12</span>
                <span className="sidebar-level-xp">2,450 / 4,000 XP</span>
              </div>
              <div className="sidebar-progress-bar">
                <div className="sidebar-progress-fill" style={{ width: '61%' }} />
              </div>
            </div>

            <div className="sidebar-rating-card">
              <Trophy size={20} strokeWidth={2} className="sidebar-rating-icon" />
              <div>
                <div className="sidebar-rating-value">1850</div>
                <div className="sidebar-rating-label">Top 3.2%</div>
              </div>
            </div>

            <div className="sidebar-stats-row">
              <div>
                <div className="sidebar-stat-num">128</div>
                <div className="sidebar-stat-label">Wins</div>
              </div>
              <div>
                <div className="sidebar-stat-num">42</div>
                <div className="sidebar-stat-label">Losses</div>
              </div>
              <div>
                <div className="sidebar-stat-num green">75%</div>
                <div className="sidebar-stat-label">Win Rate</div>
              </div>
            </div>

            <div className="sidebar-streak-card">
              <Flame size={16} strokeWidth={2.2} className="sidebar-streak-icon" />
              <div>
                <div className="sidebar-streak-num">7</div>
                <div className="sidebar-stat-label">Win Streak</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="dashboard-main">{children}</main>

        {rightSidebar && <aside className="dashboard-right">{rightSidebar}</aside>}
      </div>
    </div>
  );
}
