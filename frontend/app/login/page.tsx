'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';

const stats = [
  { icon: '👥', label: '25K+ Developers', color: 'green' },
  { icon: '⚡', label: 'Live Battles 24/7', color: 'purple' },
  { icon: '🏆', label: 'Rank. Code. Win.', color: 'orange' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
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
    <main className="auth-dark-page">
      <div className="auth-dark-grid">
        <div className="auth-dark-left">
          <div className="auth-code-badge">{`{ } CODE. COMPETE. CONQUER.`}</div>

          <h1 className="auth-dark-title">
            Welcome Back, <span className="gradient-text">Challenger</span>
          </h1>

          <p className="auth-dark-subtitle">
            Compete in real-time coding battles, solve challenges, and climb the global rankings.
          </p>

          <div className="auth-stat-pills">
            {stats.map((s) => (
              <div key={s.label} className={`auth-stat-pill auth-stat-pill--${s.color}`}>
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="auth-dark-visual">
            <Image
              src="/assets/login.png"
              alt="Code editor with live match interface"
              width={480}
              height={360}
              className="auth-visual-img"
              priority
            />
          </div>
        </div>

        <div className="auth-dark-card-wrap">
          <div className="auth-dark-card">
            <div className="auth-card-logo">
              <Image src="/assets/logo.png" alt="" width={40} height={40} aria-hidden="true" />
            </div>
            <h2>Log In</h2>
            <p>Access your account and continue coding.</p>

            <form onSubmit={handle} className="auth-form">
              <label className="field-label" htmlFor="login-email">Email Address</label>
              <div className="input-dark">
                <Mail size={16} strokeWidth={2.2} />
                <input
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </div>

              <label className="field-label" htmlFor="login-password">Password</label>
              <div className="input-dark">
                <Lock size={16} strokeWidth={2.2} />
                <input
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  type={showPassword ? 'text' : 'password'}
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>

              <div className="form-meta-row">
                <label className="remember-label">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>

              <button type="submit" className="btn-gradient btn-full">
                Log In
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>
            </form>

            <div className="divider-dark">
              <span>or continue with</span>
            </div>

            <SocialLoginButtons layout="row" />

            <p className="auth-switch-text">
              Don&apos;t have an account? <Link href="/register">Sign up</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="auth-features-bar">
        <div><span>🛡️</span><div><strong>Secure Login</strong><span>Your data is protected</span></div></div>
        <div><span>🔒</span><div><strong>Privacy First</strong><span>We respect your privacy</span></div></div>
        <div><span>⚡</span><div><strong>Live & Real-time</strong><span>Battles happen 24/7</span></div></div>
        <div><span>👥</span><div><strong>Global Community</strong><span>Compete with the best</span></div></div>
      </div>

      <footer className="auth-dark-footer">
        <span>© 2024 CodeClash. All rights reserved.</span>
        <div>
          <Link href="/terms">Terms of Service</Link>
          <span>·</span>
          <Link href="/privacy">Privacy Policy</Link>
          <span>·</span>
          <Link href="/contact">Contact Us</Link>
        </div>
      </footer>
    </main>
  );
}
