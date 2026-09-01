'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import DashboardShell from '../../components/dashboard/DashboardShell';
import CommunityRightSidebar, {
  CommunityFilters,
  CommunitySearch,
  PostCard,
} from '../../components/dashboard/CommunityRightSidebar';

const communityNav = [
  { label: 'Discussions', active: true },
  { label: 'Tips & Solutions', active: false },
  { label: 'Looking for Opponent', active: false },
  { label: 'Showcase', active: false },
  { label: 'Announcements', active: false },
];

const yourStuff = ['My Posts', 'Bookmarks', 'My Discussions', 'Following'];

const posts = [
  {
    author: 'Alex Kim',
    rating: 2450,
    time: '2h ago',
    category: 'Discussions',
    title: 'Best strategy for timed coding rounds?',
    preview: 'I have been struggling with time management during battles. What strategies do you use to optimize your approach?',
    tags: [
      { label: 'JavaScript', color: 'yellow' },
      { label: 'Algorithms', color: 'blue' },
      { label: '1v1', color: 'green' },
    ],
    comments: 24,
    views: 156,
    likes: 42,
    pinned: true,
  },
  {
    author: 'Sarah Chen',
    rating: 2380,
    time: '4h ago',
    category: 'Tips & Solutions',
    title: 'Two Sum — O(n) solution with hash map',
    preview: 'Here is an elegant O(n) solution using a hash map. Works great for interview prep too.',
    tags: [
      { label: 'JavaScript', color: 'yellow' },
      { label: 'Arrays', color: 'purple' },
    ],
    comments: 18,
    views: 234,
    likes: 67,
  },
  {
    author: 'Mike Johnson',
    rating: 1920,
    time: '6h ago',
    category: 'Looking for Opponent',
    title: 'Looking for 1700+ rated opponent for practice',
    preview: 'Available weekdays 6-9 PM UTC. Prefer algorithm-heavy challenges. DM me!',
    tags: [
      { label: '1v1', color: 'green' },
      { label: '1700+', color: 'orange' },
    ],
    comments: 8,
    views: 89,
    likes: 12,
  },
  {
    author: 'Emma Wilson',
    rating: 2280,
    time: '8h ago',
    category: 'Showcase',
    title: 'Visualizing Binary Search Trees',
    preview: 'Built an interactive BST visualization tool. Check it out and let me know what you think!',
    tags: [
      { label: 'Showcase', color: 'purple' },
      { label: 'Algorithms', color: 'blue' },
    ],
    comments: 31,
    views: 412,
    likes: 89,
  },
];

export default function CommunityPage() {
  return (
    <DashboardShell
      rightSidebar={<CommunityRightSidebar />}
    >
      <aside className="community-left-nav">
        <nav className="community-nav-section">
          {communityNav.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`community-nav-link${item.active ? ' active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="community-nav-section">
          <span className="community-nav-heading">Your Stuff</span>
          {yourStuff.map((item) => (
            <button key={item} type="button" className="community-nav-link">
              {item}
            </button>
          ))}
        </div>

        <div className="community-tournament-cta">
          <span>🏆</span>
          <p>Join Tournaments — Compete, win prizes and climb the ranks!</p>
          <button type="button" className="btn-purple btn-full">View Tournaments</button>
        </div>
      </aside>

      <div className="community-main">
        <div className="dash-page-header">
          <div>
            <h1>Community 👋</h1>
            <p>Learn, share and grow with developers from around the world.</p>
          </div>
          <button type="button" className="btn-blue">
            <Plus size={16} /> Create Post
          </button>
        </div>

        <CommunityFilters />
        <CommunitySearch />

        <div className="posts-feed">
          {posts.map((post) => (
            <PostCard key={post.title} {...post} />
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
