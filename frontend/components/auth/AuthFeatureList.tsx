import { Target, Trophy, Zap } from 'lucide-react';

const features = [
  {
    icon: Zap,
    color: 'blue' as const,
    title: 'Real-time battles',
    text: 'Challenge developers in live 1v1 matches.',
  },
  {
    icon: Trophy,
    color: 'purple' as const,
    title: 'Climb the leaderboard',
    text: 'Earn points and prove your skills.',
  },
  {
    icon: Target,
    color: 'green' as const,
    title: 'Sharpen your skills',
    text: 'Practice with real challenges and feedback.',
  },
];

export default function AuthFeatureList() {
  return (
    <div className="feature-list">
      {features.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="feature-item">
            <span className={`feature-icon feature-icon--${item.color}`}>
              <Icon size={18} strokeWidth={2.2} />
            </span>
            <div>
              <div className="feature-title">{item.title}</div>
              <div className="feature-text">{item.text}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
