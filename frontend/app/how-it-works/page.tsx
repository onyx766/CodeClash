'use client';

import { useState } from 'react';
import { ChevronRight, Code2, Play, Send, Trophy, Users } from 'lucide-react';
import DashboardShell from '../../components/dashboard/DashboardShell';
import HowItWorksRightSidebar, {
  faqItems,
  howItWorksSteps,
} from '../../components/dashboard/HowItWorksRightSidebar';

const stepIcons = [Users, Code2, Play, Send, Trophy, Trophy];

export default function HowItWorksPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <DashboardShell rightSidebar={<HowItWorksRightSidebar />}>
      <div className="how-page">
        <div className="how-page-header">
          <div>
            <h1>
              How <span className="gradient-text">CodeClash</span> Works
            </h1>
            <p>Jump in, code, compete, and climb the leaderboard.</p>
          </div>
          <div className="how-hero-art" aria-hidden="true">
            <div className="how-laptop">💻</div>
            <div className="how-trophy">🏆</div>
          </div>
        </div>

        <div className="how-timeline">
          {howItWorksSteps.map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <article key={step.num} className="how-step-card">
                <div className="how-step-num-col">
                  <span className="how-step-circle">{step.num}</span>
                  {index < howItWorksSteps.length - 1 && (
                    <div className="how-step-connector" aria-hidden="true" />
                  )}
                </div>
                <div className="how-step-content">
                  <div className="how-step-icon">
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>
                  <div className="how-step-preview">
                    <div className={`preview-box preview-box--${step.preview}`}>
                      {step.preview === 'match' && (
                        <>
                          <button type="button" className="preview-btn blue">Find Match</button>
                          <button type="button" className="preview-btn purple">Create Room</button>
                          <button type="button" className="preview-btn green">Join Room</button>
                        </>
                      )}
                      {step.preview === 'challenge' && (
                        <div className="preview-challenge">
                          <strong>Two Sum</strong>
                          <span>Difficulty: Medium</span>
                        </div>
                      )}
                      {step.preview === 'code' && (
                        <div className="preview-code">
                          <code>{`function twoSum(nums, target) {\n  // your code\n}`}</code>
                          <button type="button" className="preview-btn green">Run Tests</button>
                        </div>
                      )}
                      {step.preview === 'submit' && (
                        <div className="preview-submit">
                          <button type="button" className="preview-btn blue">Submit Solution</button>
                          <span>✓ Submitted! Waiting...</span>
                        </div>
                      )}
                      {step.preview === 'score' && (
                        <div className="preview-score">
                          <div>You: <strong>973</strong></div>
                          <div>Opponent: <strong>882</strong></div>
                        </div>
                      )}
                      {step.preview === 'rank' && (
                        <div className="preview-rank">
                          <span className="green">+24 rating</span>
                          <span>#3,248 → #3,120</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <section className="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqItems.map((item, i) => (
              <div key={item.q} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {item.q}
                  <ChevronRight size={16} className="faq-chevron" />
                </button>
                {openFaq === i && <p className="faq-answer">{item.a}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
