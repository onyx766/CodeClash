import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Play, Zap } from 'lucide-react';

export default function Hero() {
  return (
    <section className="landing-hero">
      <div className="cc-container landing-hero-grid">
        <div className="landing-hero-content">
          <div className="landing-badge">
            <Zap size={14} strokeWidth={2.5} />
            <span>REAL-TIME CODE BATTLES</span>
          </div>

          <h1 className="landing-title">
            Code. Compete. <span className="gradient-text">Conquer.</span>
          </h1>

          <p className="landing-desc">
            Challenge developers in real-time JavaScript battles. Solve problems, earn points,
            and climb the global leaderboard.
          </p>

          <div className="landing-cta-row">
            <Link href="/register" className="btn-gradient">
              Start Coding Now
              <ArrowRight size={18} strokeWidth={2.4} />
            </Link>
            <Link href="/#how-it-works" className="btn-outline">
              <Play size={16} strokeWidth={2.2} />
              Watch How It Works
            </Link>
          </div>

          <div className="landing-social-proof">
            <div className="avatar-row">
              {['A', 'S', 'M', 'E', 'D'].map((l, i) => (
                <span key={l} className="proof-avatar" style={{ zIndex: 5 - i }}>
                  {l}
                </span>
              ))}
            </div>
            <span>
              <strong>12,248+</strong> developers are already coding · <strong className="green">1,248</strong> online now
            </span>
          </div>

          <div className="landing-trust-row">
            <span><Zap size={14} /> Live Battles</span>
            <span>⚖️ Fair Play</span>
            <span>📊 Smart Scoring</span>
          </div>
        </div>

        <div className="landing-hero-visual">
          <Image
            src="/assets/landing.png"
            alt="Developers competing in a live CodeClash battle"
            width={640}
            height={480}
            priority
            className="landing-hero-img"
          />
        </div>
      </div>
    </section>
  );
}
