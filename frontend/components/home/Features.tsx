import { Code2, Signal, Trophy, Zap } from 'lucide-react';

const features = [
  {
    icon: Zap,
    color: 'blue',
    title: 'Real-Time Battles',
    desc: 'Compete head-to-head in live coding duels with developers worldwide.',
  },
  {
    icon: Code2,
    color: 'purple',
    title: 'Smart Challenges',
    desc: 'Curated problems from easy to expert, with hidden test cases.',
  },
  {
    icon: Signal,
    color: 'green',
    title: 'Fair Matchmaking',
    desc: 'ELO-based rating system pairs you with opponents of similar skill.',
  },
  {
    icon: Trophy,
    color: 'orange',
    title: 'Global Leaderboard',
    desc: 'Climb the ranks, earn badges, and prove you are the best coder.',
  },
];

export default function Features() {
  return (
    <section id="features" className="landing-section landing-features">
      <h2 className="landing-section-title">Built for Developers, by Developers</h2>
      <div className="landing-features-grid">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="landing-feature-card">
              <div className={`landing-feature-icon landing-feature-icon--${feature.color}`}>
                <Icon size={22} strokeWidth={2} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
