import Link from 'next/link';
import { ArrowRight, MessageCircle, Star, Users } from 'lucide-react';

const testimonials = [
  {
    name: 'Alex Kim',
    handle: '@alexkim',
    quote: 'CodeClash transformed how I practice algorithms. The real-time battles keep me sharp and motivated.',
    color: '#3b82f6',
  },
  {
    name: 'Sarah Chen',
    handle: '@sarahchen',
    quote: 'Best platform for competitive coding practice. The matchmaking is fair and the community is amazing.',
    color: '#8b5cf6',
  },
  {
    name: 'Mike Johnson',
    handle: '@mikej',
    quote: 'I went from 1200 to 1800 rating in 3 months. The leaderboard keeps me coming back every day.',
    color: '#10b981',
  },
];

export default function CommunitySection() {
  return (
    <section className="landing-section landing-community">
      <div className="cc-container landing-community-grid">
        <div className="landing-community-copy">
          <h2 className="landing-section-title left">Join a Thriving Developer Community</h2>
          <p>
            Connect with developers worldwide. Share solutions, discuss strategies,
            and grow together.
          </p>

          <div className="community-mini-stats">
            <div>
              <MessageCircle size={20} strokeWidth={2} />
              <div>
                <strong>3.2K</strong>
                <span>Discussions</span>
              </div>
            </div>
            <div>
              <Star size={20} strokeWidth={2} />
              <div>
                <strong>1.8K</strong>
                <span>Tips & Solutions</span>
              </div>
            </div>
            <div>
              <Users size={20} strokeWidth={2} />
              <div>
                <strong>12.4K</strong>
                <span>Active Members</span>
              </div>
            </div>
          </div>

          <Link href="/community" className="btn-gradient">
            Explore Community
            <ArrowRight size={16} strokeWidth={2.2} />
          </Link>
        </div>

        <div className="testimonial-carousel">
          {testimonials.map((t) => (
            <article key={t.handle} className="testimonial-card">
              <div className="testimonial-header">
                <span className="testimonial-avatar" style={{ background: t.color }}>
                  {t.name[0]}
                </span>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-handle">{t.handle}</div>
                </div>
              </div>
              <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
              <div className="testimonial-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill="#fbbf24" stroke="#fbbf24" />
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
