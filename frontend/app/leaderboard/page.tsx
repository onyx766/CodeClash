'use client';

import { Trophy } from 'lucide-react';
import DashboardShell from '../../components/dashboard/DashboardShell';
import LeaderboardRightSidebar, {
  LeaderboardTable,
  SeasonCard,
  YourStatsSidebar,
} from '../../components/dashboard/LeaderboardRightSidebar';

const filterTabs = ['Global', 'Weekly', 'Monthly', 'Friends'];

export default function LeaderboardPage() {
  return (
    <DashboardShell rightSidebar={<LeaderboardRightSidebar />}>
      <aside className="leaderboard-left-extra">
        <div className="dash-panel">
          <h3>Your Stats</h3>
          <YourStatsSidebar />
        </div>
        <SeasonCard />
      </aside>

      <div className="leaderboard-main">
        <div className="dash-page-header">
          <div>
            <h1>
              <Trophy size={28} strokeWidth={2} className="inline-trophy" />
              Leaderboard
            </h1>
            <p>Top developers from around the world</p>
          </div>
          <div className="season-indicator">
            <span className="live-dot" />
            Season 1
          </div>
        </div>

        <div className="leaderboard-filters">
          {filterTabs.map((tab, i) => (
            <button key={tab} type="button" className={`filter-pill${i === 0 ? ' active' : ''}`}>
              {tab}
            </button>
          ))}
          <select className="country-select" defaultValue="">
            <option value="">Country</option>
            <option value="US">United States</option>
            <option value="CN">China</option>
            <option value="UK">United Kingdom</option>
          </select>
        </div>

        <LeaderboardTable />
      </div>
    </DashboardShell>
  );
}
