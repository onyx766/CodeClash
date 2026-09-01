import Link from 'next/link';
import { ArrowRight, Flame } from 'lucide-react';

const leaderboardPreview = [
  { rank: 1, name: 'Alex Kim', badge: 'Pro', rating: 2450, wins: 342, winRate: '82%', streak: 12, color: '#fbbf24' },
  { rank: 2, name: 'Sarah Chen', badge: 'Expert', rating: 2380, wins: 298, winRate: '79%', streak: 8, color: '#94a3b8' },
  { rank: 3, name: 'Mike Johnson', badge: 'Expert', rating: 2310, wins: 276, winRate: '76%', streak: 5, color: '#cd7f32' },
  { rank: 4, name: 'Emma Wilson', badge: 'Advanced', rating: 2280, wins: 254, winRate: '74%', streak: 3, color: '#64748b' },
  { rank: 5, name: 'David Lee', badge: 'Advanced', rating: 2250, wins: 241, winRate: '72%', streak: 6, color: '#64748b' },
];

export default function LeaderboardPreview() {
  return (
    <section className="landing-section landing-leaderboard">
      <div className="cc-container landing-leaderboard-grid">
        <div className="landing-leaderboard-copy">
          <h2 className="landing-section-title left">Climb the Leaderboard</h2>
          <p>
            Compete against the best developers worldwide. Track your progress, earn ratings,
            and see your name rise through the ranks.
          </p>
          <Link href="/leaderboard" className="btn-outline">
            View Full Leaderboard
            <ArrowRight size={16} strokeWidth={2.2} />
          </Link>
        </div>

        <div className="landing-lb-table-wrap">
          <table className="landing-lb-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Rating</th>
                <th>Wins</th>
                <th>Win Rate</th>
                <th>Streak</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardPreview.map((p) => (
                <tr key={p.name}>
                  <td>
                    <span className="lb-rank" style={p.rank <= 3 ? { background: p.color } : undefined}>
                      {p.rank}
                    </span>
                  </td>
                  <td>
                    <div className="lb-player">
                      <span className="lb-avatar">{p.name[0]}</span>
                      <div>
                        <span className="lb-name">{p.name}</span>
                        <span className={`lb-badge lb-badge--${p.badge.toLowerCase()}`}>{p.badge}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="rating-purple">{p.rating}</span></td>
                  <td><span className="wins-green">{p.wins}</span></td>
                  <td>{p.winRate}</td>
                  <td>
                    <span className="streak-orange">
                      <Flame size={13} /> {p.streak}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
