'use client';

import { Flame, Gift, TrendingUp, Trophy } from 'lucide-react';

const topPlayers = [
  { name: 'Alex Kim', rating: 2450, change: '+42', color: '#3b82f6' },
  { name: 'Sarah Chen', rating: 2380, change: '+28', color: '#8b5cf6' },
  { name: 'Mike Johnson', rating: 2310, change: '+15', color: '#10b981' },
];

const recentWinners = [
  { text: 'Tyler won against Alex', time: '2m ago' },
  { text: 'Sarah won against Mike', time: '5m ago' },
  { text: 'Emma won against David', time: '8m ago' },
  { text: 'Lisa won against John', time: '12m ago' },
];

export default function LeaderboardRightSidebar() {
  return (
    <>
      <section className="dash-panel">
        <h3>Top Players This Week</h3>
        <ul className="top-players-list">
          {topPlayers.map((p) => (
            <li key={p.name} className="top-player-item">
              <span className="top-player-avatar" style={{ background: p.color }}>
                {p.name[0]}
              </span>
              <div className="top-player-info">
                <span className="top-player-name">{p.name}</span>
                <span className="top-player-rating">{p.rating}</span>
              </div>
              <span className="top-player-change">{p.change}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-panel">
        <h3>Your Rank</h3>
        <div className="your-rank-card">
          <div className="your-rank-header">
            <span className="your-rank-num">#3,248</span>
            <span className="your-rank-pct">Top 3.2%</span>
          </div>
          <div className="your-rank-rating">
            Rating <strong>1850</strong> <span className="green">(+128)</span>
          </div>
          <div className="rank-chart">
            <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="rank-chart-svg">
              <defs>
                <linearGradient id="rankGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,50 L30,45 L60,40 L90,35 L120,25 L150,20 L180,15 L200,10 L200,60 L0,60 Z"
                fill="url(#rankGrad)"
              />
              <polyline
                points="0,50 30,45 60,40 90,35 120,25 150,20 180,15 200,10"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </section>

      <section className="dash-panel">
        <h3>Recent Winners</h3>
        <ul className="winners-list">
          {recentWinners.map((w) => (
            <li key={w.text} className="winner-item">
              <Trophy size={14} strokeWidth={2} className="winner-icon" />
              <div>
                <span>{w.text}</span>
                <span className="activity-time">{w.time}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-panel dash-rewards-card">
        <div className="rewards-xp">
          <span>3,450 / 5,000 XP</span>
          <div className="sidebar-progress-bar">
            <div className="sidebar-progress-fill" style={{ width: '69%' }} />
          </div>
        </div>
        <Gift size={40} strokeWidth={1.5} className="dash-bonus-icon" />
        <h3>Season Rewards</h3>
        <a href="#" className="dash-link">View Rewards</a>
      </section>
    </>
  );
}

export function LeaderboardTable() {
  const players = [
    { rank: 1, name: 'Alex Kim', country: 'US', badge: 'Pro', rating: 2450, wins: 342, winRate: '82%', streak: 12, color: '#fbbf24' },
    { rank: 2, name: 'Sarah Chen', country: 'CN', badge: 'Expert', rating: 2380, wins: 298, winRate: '79%', streak: 8, color: '#94a3b8' },
    { rank: 3, name: 'Mike Johnson', country: 'UK', badge: 'Expert', rating: 2310, wins: 276, winRate: '76%', streak: 5, color: '#cd7f32' },
    { rank: 4, name: 'Emma Wilson', country: 'CA', badge: 'Advanced', rating: 2280, wins: 254, winRate: '74%', streak: 3, color: '#64748b' },
    { rank: 5, name: 'David Lee', country: 'KR', badge: 'Advanced', rating: 2250, wins: 241, winRate: '72%', streak: 6, color: '#64748b' },
    { rank: 6, name: 'Lisa Park', country: 'JP', badge: 'Pro', rating: 2220, wins: 228, winRate: '71%', streak: 4, color: '#64748b' },
    { rank: 7, name: 'John Smith', country: 'DE', badge: 'Expert', rating: 2190, wins: 215, winRate: '70%', streak: 2, color: '#64748b' },
    { rank: 8, name: 'Anna Brown', country: 'FR', badge: 'Advanced', rating: 2160, wins: 202, winRate: '68%', streak: 7, color: '#64748b' },
  ];

  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Rating</th>
            <th>Wins</th>
            <th>Win Rate</th>
            <th>Top Streak</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.name} className={p.rank <= 3 ? `rank-row rank-row--${p.rank}` : ''}>
              <td>
                <span className="rank-badge" style={p.rank <= 3 ? { background: p.color } : undefined}>
                  {p.rank}
                </span>
              </td>
              <td>
                <div className="player-cell">
                  <span className="player-avatar">{p.name[0]}</span>
                  <div>
                    <div className="player-name-row">
                      <span className="player-name">{p.name}</span>
                      <span className={`skill-badge skill-badge--${p.badge.toLowerCase()}`}>{p.badge}</span>
                    </div>
                    <span className="player-country">{p.country}</span>
                  </div>
                </div>
              </td>
              <td><span className="rating-purple">{p.rating}</span></td>
              <td><span className="wins-green">{p.wins}</span></td>
              <td><span className="winrate-green">{p.winRate}</span></td>
              <td>
                <span className="streak-orange">
                  <Flame size={14} /> {p.streak}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button type="button" className="page-btn active">1</button>
        <button type="button" className="page-btn">2</button>
        <button type="button" className="page-btn">3</button>
        <button type="button" className="page-btn">Next →</button>
      </div>
    </div>
  );
}

export function SeasonCard() {
  return (
    <div className="season-card">
      <div className="season-time">Ends in 24d 12h 45m</div>
      <Trophy size={32} strokeWidth={1.8} className="season-icon" />
      <div className="season-title">Season 1</div>
      <button type="button" className="btn-purple btn-full">View Season</button>
    </div>
  );
}

export function YourStatsSidebar() {
  return (
    <div className="your-stats-sidebar">
      <div className="your-stats-rating">
        <TrendingUp size={20} strokeWidth={2} className="sidebar-rating-icon" />
        <div>
          <div className="sidebar-rating-value">1850</div>
          <div className="sidebar-rating-label">Top 3.2%</div>
        </div>
      </div>
      <div className="rank-chart rank-chart--sm">
        <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="rank-chart-svg">
          <polyline
            points="0,35 40,30 80,28 120,20 160,15 200,8"
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2"
          />
        </svg>
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
          <div className="sidebar-streak-num">7 Matches</div>
          <div className="sidebar-stat-label">Best Streak</div>
        </div>
      </div>
      <div className="global-rank">
        <span>Global Rank</span>
        <span className="global-rank-num">#3,248</span>
        <span className="green">+128</span>
      </div>
    </div>
  );
}
