'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Code2, EyeOff, Globe, Lock, Mail, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const featureHighlights = [
  { icon: Zap, title: 'Real-time battles', text: 'Challenge developers in live 1v1 matches.' },
  { icon: Trophy, title: 'Climb the leaderboard', text: 'Earn points and prove your skills.' },
  { icon: Target, title: 'Sharpen your skills', text: 'Practice with real challenges and feedback.' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await login(email, password);
      router.push('/lobby');
    } catch {
      alert('Login failed');
    }
  };

  return (
    <main className="auth-page-shell">
      <div className="auth-left-panel">
        <div className="auth-bracket">{`{`}</div>

        <div className="auth-tag">WELCOME BACK</div>

        <h1 className="auth-title">
          Log in to
          <span>CodeClash</span>
        </h1>

        <p className="auth-subtitle">
          Compete in real-time JavaScript battles,
          solve challenges, and climb the rankings.
        </p>

        <div className="feature-list">
          {featureHighlights.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="feature-item">
                <span className="feature-icon">
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="feature-title">{item.title}</div>
                  <div className="feature-text">{item.text}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="auth-signup-link">
          New to CodeClash? <a href="/register">Create an account</a>
        </div>
      </div>

      <div className="auth-card-wrap">
        <div className="auth-card">
          <h2>Welcome back</h2>
          <p>Enter your credentials to access your account</p>

          <form onSubmit={handle} className="auth-form">
            <label className="field-label">Email</label>
            <div className="input-shell">
              <span className="input-icon"><Mail size={16} strokeWidth={2.2} /></span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
              />
            </div>

            <label className="field-label">Password</label>
            <div className="input-shell">
              <span className="input-icon"><Lock size={16} strokeWidth={2.2} /></span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type="password"
              />
              <span className="input-icon right"><EyeOff size={16} strokeWidth={2.2} /></span>
            </div>

            <div className="form-meta">
              <a href="/forgot-password">Forgot password?</a>
            </div>

            <button type="submit" className="primary-submit">
              Log in
            </button>
          </form>

          <div className="divider"><span>or continue with</span></div>

          <div className="social-stack">
            <button type="button" className="social-btn">
              <Globe size={18} strokeWidth={2.1} />
              Continue with GitHub
            </button>
            <button type="button" className="social-btn">
              <Code2 size={18} strokeWidth={2.1} />
              Continue with Google
            </button>
          </div>

          <p className="terms-text">
            By continuing, you agree to our <a href="/terms">Terms of Service</a>
            and <a href="/privacy">Privacy Policy</a>
          </p>
        </div>
      </div>
    </main>
  );
}
