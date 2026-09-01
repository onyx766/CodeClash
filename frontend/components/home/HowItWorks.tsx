import { Code2, Play, Send, Trophy, Users } from 'lucide-react';

const steps = [
  { num: '01', icon: Users, title: 'Find or Create Match' },
  { num: '02', icon: Code2, title: 'Solve the Challenge' },
  { num: '03', icon: Play, title: 'Run & Submit' },
  { num: '04', icon: Send, title: 'Earn Points & Climb', altIcon: Trophy },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="landing-section landing-how">
      <h2 className="landing-section-title">Start. Code. Win.</h2>
      <div className="landing-steps-row">
        {steps.map((step, index) => {
          const Icon = step.altIcon && index === 3 ? step.altIcon : step.icon;
          return (
            <div key={step.num} className="landing-step">
              <div className="landing-step-num">{step.num}</div>
              <div className="landing-step-icon">
                <Icon size={22} strokeWidth={2} />
              </div>
              <h3>{step.title}</h3>
              {index < steps.length - 1 && <div className="landing-step-line" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
