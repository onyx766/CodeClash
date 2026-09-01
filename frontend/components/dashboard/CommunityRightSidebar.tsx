'use client';

import { Calendar, Eye, Heart, MessageCircle, Search, Star } from 'lucide-react';

const topContributors = [
  { rank: 1, name: 'Alex Kim', rating: 2450, posts: 128, color: '#fbbf24' },
  { rank: 2, name: 'Sarah Chen', rating: 2380, posts: 96, color: '#94a3b8' },
  { rank: 3, name: 'Mike Johnson', rating: 2310, posts: 84, color: '#cd7f32' },
  { rank: 4, name: 'Emma Wilson', rating: 2280, posts: 72, color: '#64748b' },
  { rank: 5, name: 'David Lee', rating: 2250, posts: 68, color: '#64748b' },
];

const upcomingEvents = [
  { title: 'Weekly 1v1 Tournament', date: 'Sat, Sep 6', time: '2:00 PM UTC', going: 1024, color: 'purple' },
  { title: 'JS Algorithm Workshop', date: 'Wed, Sep 10', time: '6:00 PM UTC', going: 512, color: 'orange' },
];

export default function CommunityRightSidebar() {
  return (
    <>
      <section className="dash-panel">
        <h3>Top Contributors</h3>
        <ul className="contributors-list">
          {topContributors.map((c) => (
            <li key={c.name} className="contributor-item">
              <span className="contributor-rank" style={{ background: c.color }}>
                {c.rank}
              </span>
              <span className="contributor-avatar">{c.name[0]}</span>
              <div className="contributor-info">
                <span className="contributor-name">{c.name}</span>
                <span className="contributor-meta">{c.rating} · {c.posts} posts</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-header">
          <h3>Online Members</h3>
          <a href="#" className="dash-link">View All</a>
        </div>
        <div className="avatar-stack">
          {['A', 'S', 'M', 'E', 'D'].map((l, i) => (
            <span key={l} className="stacked-avatar" style={{ zIndex: 5 - i }}>
              {l}
            </span>
          ))}
          <span className="stacked-count">+1243</span>
        </div>
      </section>

      <section className="dash-panel">
        <h3>Community Stats</h3>
        <div className="stats-grid-2x2">
          <div className="mini-stat-card purple">
            <span className="mini-stat-value">12.4K</span>
            <span className="mini-stat-label">Members</span>
          </div>
          <div className="mini-stat-card green">
            <span className="mini-stat-value">3.2K</span>
            <span className="mini-stat-label">Posts</span>
          </div>
          <div className="mini-stat-card blue">
            <span className="mini-stat-value">8.7K</span>
            <span className="mini-stat-label">Comments</span>
          </div>
          <div className="mini-stat-card orange">
            <span className="mini-stat-value">24</span>
            <span className="mini-stat-label">Daily Active</span>
          </div>
        </div>
      </section>

      <section className="dash-panel">
        <h3>Upcoming Events</h3>
        <div className="events-list">
          {upcomingEvents.map((event) => (
            <div key={event.title} className={`event-card event-card--${event.color}`}>
              <Calendar size={18} strokeWidth={2} />
              <div>
                <div className="event-title">{event.title}</div>
                <div className="event-date">{event.date} · {event.time}</div>
                <div className="event-going">{event.going.toLocaleString()} going</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function PostCard({
  author,
  rating,
  time,
  category,
  title,
  preview,
  tags,
  comments,
  views,
  likes,
  pinned,
}: {
  author: string;
  rating: number;
  time: string;
  category: string;
  title: string;
  preview: string;
  tags: { label: string; color: string }[];
  comments: number;
  views: number;
  likes: number;
  pinned?: boolean;
}) {
  return (
    <article className="post-card">
      <div className="post-header">
        <span className="post-avatar">{author[0]}</span>
        <div>
          <div className="post-author-row">
            <span className="post-author">{author}</span>
            <span className="post-rating">{rating}</span>
            {pinned && <span className="post-pinned">Pinned</span>}
          </div>
          <span className="post-meta">{time} in {category}</span>
        </div>
      </div>
      <h3 className="post-title">{title}</h3>
      <p className="post-preview">{preview}</p>
      <div className="post-tags">
        {tags.map((tag) => (
          <span key={tag.label} className={`post-tag post-tag--${tag.color}`}>
            {tag.label}
          </span>
        ))}
      </div>
      <div className="post-footer">
        <span><MessageCircle size={14} /> {comments}</span>
        <span><Eye size={14} /> {views}</span>
        <span><Heart size={14} /> {likes}</span>
        <span className="post-footer-right"><Star size={14} /></span>
      </div>
    </article>
  );
}

export function CommunityFilters() {
  const filters = ['All', 'Discussions', 'Tips & Solutions', 'Looking for Opponent', 'Showcase', 'Announcements'];
  return (
    <div className="community-filters">
      {filters.map((f, i) => (
        <button key={f} type="button" className={`filter-pill${i === 0 ? ' active' : ''}`}>
          {f}
        </button>
      ))}
    </div>
  );
}

export function CommunitySearch() {
  return (
    <div className="community-search">
      <Search size={16} strokeWidth={2} className="search-icon" />
      <input type="search" placeholder="Search posts, topics, users..." />
      <button type="button" className="btn-ghost-sm">Filters</button>
    </div>
  );
}
