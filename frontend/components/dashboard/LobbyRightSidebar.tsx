'use client';

import { Flame, Gift, RefreshCw, Shield, Star, Trophy } from 'lucide-react';

const onlineFriends = [
  { name: 'Alex Kim', status: 'In Lobby', rating: 1920, color: '#3b82f6' },
  { name: 'Sarah Chen', status: 'In a Match', rating: 1780, color: '#8b5cf6' },
  { name: 'Mike Johnson', status: 'Online', rating: 1650, color: '#10b981' },
  { name: 'Emma Wilson', status: 'In Lobby', rating: 1890, color: '#f59e0b' },
  { name: 'David Lee', status: 'Online', rating: 1720, color: '#ec4899' },
  { name: 'Lisa Park', status: 'In a Match', rating: 1810, color: '#06b6d4' },
];

const recentActivity = [
  { icon: Trophy, color: 'green', text: 'You won against Alex (+24 Rating)', time: '2m ago' },
  { icon: Shield, color: 'purple', text: "New personal best! Solved 'Two Sum' in 1.24s", time: '15m ago' },
  { icon: Star, color: 'blue', text: 'You reached Level 12', time: '1h ago' },
  { icon: Flame, color: 'orange', text: 'Tournament starts soon: JS Masters', time: '2h ago' },
];

export default function LobbyRightSidebar() {
  return (
    <>
      <section className="dash-panel">
        <div className="dash-panel-header">
          <h3>Online Friends</h3>
          <span className="dash-panel-meta">8 online</span>
        </div>
        <ul className="friends-list">
          {onlineFriends.map((friend) => (
            <li key={friend.name} className="friend-item">
              <span className="friend-avatar" style={{ background: friend.color }}>
                {friend.name[0]}
              </span>
              <div className="friend-info">
                <span className="friend-name">{friend.name}</span>
                <span className="friend-status">{friend.status}</span>
              </div>
              <span className="friend-rating">{friend.rating}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-panel">
        <h3>Recent Activity</h3>
        <ul className="activity-list">
          {recentActivity.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.text} className="activity-item">
                <span className={`activity-icon activity-icon--${item.color}`}>
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                <div>
                  <p>{item.text}</p>
                  <span className="activity-time">{item.time}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="dash-panel dash-bonus-card">
        <Gift size={32} strokeWidth={1.8} className="dash-bonus-icon" />
        <h3>Daily Bonus</h3>
        <p>Complete a match today and claim your bonus!</p>
        <button type="button" className="btn-purple">
          Claim Bonus
        </button>
      </section>
    </>
  );
}

export function RefreshRoomsButton({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="btn-ghost refresh-btn" onClick={onClick}>
      <RefreshCw size={14} strokeWidth={2.2} />
      Refresh Rooms
    </button>
  );
}
