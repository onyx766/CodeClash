'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, AtSign, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';

const stats = [
  { icon: '👥', label: '25K+ Developers', color: 'green' },
  { icon: '⚡', label: 'Live Battles 24/7', color: 'purple' },
  { icon: '🏆', label: 'Rank. Code. Win.', color: 'orange' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();

  const handle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    try {
      await register(email, username, password);
      router.push('/lobby');
    } catch {
      alert('Register failed');
    }
  };

  return (
    <main className="auth-dark-page">
      <div className="auth-dark-grid">
        <div className="auth-dark-left">
          <div className="auth-code-badge">{`{ } CODE. COMPETE. CONQUER.`}</div>

          <h1 className="auth-dark-title">
            Join the Arena, <span className="gradient-text">Challenger</span>
          </h1>

          <p className="auth-dark-subtitle">
            Create your account and start coding battles, climb the leaderboard,
            and join a community of developers worldwide.
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
            <h2>Create Account</h2>
            <p>Start your coding journey. The arena awaits.</p>

            <form onSubmit={handle} className="auth-form">
              <label className="field-label" htmlFor="register-username">Username</label>
              <div className="input-dark">
                <UserRound size={16} strokeWidth={2.2} />
                <input
                  id="register-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="johndoe"
                  required
                />
              </div>

              <label className="field-label" htmlFor="register-email">Email Address</label>
              <div className="input-dark">
                <Mail size={16} strokeWidth={2.2} />
                <input
                  id="register-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </div>

              <label className="field-label" htmlFor="register-password">Password</label>
              <div className="input-dark">
                <Lock size={16} strokeWidth={2.2} />
                <input
                  id="register-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  type={showPassword ? 'text' : 'password'}
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>

              <label className="field-label" htmlFor="register-confirm">Confirm Password</label>
              <div className="input-dark">
                <Lock size={16} strokeWidth={2.2} />
                <input
                  id="register-confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  type={showConfirm ? 'text' : 'password'}
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>

              <label className="remember-label agree-label">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                />
                I agree to the <Link href="/terms">Terms of Service</Link> and{' '}
                <Link href="/privacy">Privacy Policy</Link>
              </label>

              <button type="submit" className="btn-gradient btn-full">
                Create Account
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>
            </form>

            <div className="divider-dark">
              <span>or continue with</span>
            </div>

            <SocialLoginButtons layout="row" />

            <p className="auth-switch-text">
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="auth-features-bar auth-features-bar--3">
        <div><span>🛡️</span><div><strong>Secure Signup</strong><span>Your data is encrypted and safe</span></div></div>
        <div><span>⚡</span><div><strong>Real-Time Battles</strong><span>Compete in live coding duels</span></div></div>
        <div><span>🌐</span><div><strong>Global Community</strong><span>Connect, learn, and grow together</span></div></div>
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
