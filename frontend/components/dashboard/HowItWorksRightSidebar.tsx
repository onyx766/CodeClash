'use client';

import { Check, Rocket, TrendingUp } from 'lucide-react';

const matchFormat = [
  '1v1 Real-time Battles',
  'Best of 3 Rounds',
  '15 min per round',
  'Multiple languages',
];

const scoring = [
  { label: 'Correctness', points: '700 pts', color: 'green', width: '70%' },
  { label: 'Performance', points: '150 pts', color: 'blue', width: '15%' },
  { label: 'Time Bonus', points: '150 pts', color: 'orange', width: '15%' },
];

export default function HowItWorksRightSidebar() {
  return (
    <>
      <section className="dash-panel">
        <h3>Match Format</h3>
        <ul className="check-list">
          {matchFormat.map((item) => (
            <li key={item}>
              <Check size={14} strokeWidth={2.5} className="check-icon" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-panel">
        <h3>Scoring System</h3>
        <div className="scoring-bars">
          {scoring.map((s) => (
            <div key={s.label} className="scoring-item">
              <div className="scoring-label-row">
                <span>{s.label}</span>
                <span>{s.points}</span>
              </div>
              <div className="scoring-bar">
                <div className={`scoring-fill scoring-fill--${s.color}`} style={{ width: s.width }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-panel">
        <h3>Rating System</h3>
        <p className="dash-panel-text">
          Elo-based rating system ensures fair matchmaking. Win against higher-rated opponents to gain more points.
        </p>
        <TrendingUp size={24} strokeWidth={2} className="rating-system-icon" />
      </section>

      <section className="dash-panel dash-luck-card">
        <Rocket size={28} strokeWidth={1.8} />
        <h3>Good Luck!</h3>
        <p>Code, compete, have fun and climb the ranks!</p>
      </section>
    </>
  );
}

export const howItWorksSteps = [
  {
    num: '01',
    title: 'Find an Opponent',
    desc: 'Use Quick Match to find an opponent of similar skill, or create/join a private room.',
    preview: 'match',
  },
  {
    num: '02',
    title: 'Solve the Challenge',
    desc: 'Read the problem, write your solution in your preferred language, and optimize for speed.',
    preview: 'challenge',
  },
  {
    num: '03',
    title: 'Run & Test Your Code',
    desc: 'Execute your code against sample test cases before submitting your final solution.',
    preview: 'code',
  },
  {
    num: '04',
    title: 'Submit Your Solution',
    desc: 'Submit when ready. Your solution is evaluated against hidden test cases.',
    preview: 'submit',
  },
  {
    num: '05',
    title: 'Score is Calculated',
    desc: 'Points awarded for correctness, performance, and time bonus. Compare with your opponent.',
    preview: 'score',
  },
  {
    num: '06',
    title: 'Win & Rank Up',
    desc: 'Winner takes rating points. Climb the leaderboard and unlock achievements.',
    preview: 'rank',
  },
];

export const faqItems = [
  { q: 'How does the scoring work?', a: 'Points are awarded for correctness (700), performance (150), and time bonus (150).' },
  { q: 'What happens if time runs out?', a: 'Your current code is auto-submitted. Partial solutions may earn partial points.' },
  { q: 'Can I change language?', a: 'Yes, you can switch languages before submitting, but not after submission.' },
];
