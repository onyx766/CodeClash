import { Code2, Globe, Swords, Users } from 'lucide-react';

const stats = [
  { icon: Users, value: '25K+', label: 'Developers', color: 'purple' },
  { icon: Swords, value: '150K+', label: 'Battles Played', color: 'green' },
  { icon: Code2, value: '1.2M+', label: 'Lines of Code', color: 'orange' },
  { icon: Globe, value: '120+', label: 'Countries', color: 'blue' },
];

export default function Stats() {
  return (
    <section className="landing-stats">
      <div className="cc-container landing-stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="landing-stat-item">
              <div className={`landing-stat-icon landing-stat-icon--${stat.color}`}>
                <Icon size={22} strokeWidth={2} />
              </div>
              <div>
                <div className="landing-stat-value">{stat.value}</div>
                <div className="landing-stat-label">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
