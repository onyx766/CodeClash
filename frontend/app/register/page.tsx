'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '../../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  const handle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await register(email, username, password);
      router.push('/lobby');
    } catch {
      alert('Register failed');
    }
  };

  return (
    <main className="auth-page-shell auth-page-shell--compact">
      <div className="auth-left-panel">
        <div className="auth-bracket">{`{`}</div>

        <div className="auth-tag">JOIN CODECLASH</div>

        <h1 className="auth-title auth-title--large">
          Create your
          <span>account</span>
        </h1>

        <p className="auth-subtitle auth-subtitle--small">
          Join thousands of developers in real-time JavaScript battles.
          Compete, learn, and climb the rankings.
        </p>

        <div className="feature-list">
          <div className="feature-item">
            <span className="feature-icon feature-icon--blue">⚡</span>
            <div>
              <div className="feature-title">Real-time battles</div>
              <div className="feature-text">Challenge developers in live 1v1 matches.</div>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon feature-icon--purple">🏆</span>
            <div>
              <div className="feature-title">Climb the leaderboard</div>
              <div className="feature-text">Earn points and prove your skills.</div>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon feature-icon--green">◎</span>
            <div>
              <div className="feature-title">Sharpen your skills</div>
              <div className="feature-text">Practice with real challenges and feedback.</div>
            </div>
          </div>
        </div>

        <div className="auth-signup-link">
          Already have an account? <a href="/login">Log in</a>
        </div>
      </div>

      <div className="auth-card-wrap">
        <div className="auth-card">
          <h2>Create your account</h2>
          <p>Enter your details to get started</p>

          <form onSubmit={handle} className="auth-form">
            <div className="two-col-fields">
              <div className="field-group">
                <label className="field-label">Full name</label>
                <div className="input-shell">
                  <span className="input-icon">◌</span>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Username</label>
                <div className="input-shell input-shell--tight">
                  <span className="input-icon">@</span>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johndoe" />
                </div>
              </div>
            </div>

            <label className="field-label">Email address</label>
            <div className="input-shell">
              <span className="input-icon">✉</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
            </div>

            <label className="field-label">Password</label>
            <div className="input-shell">
              <span className="input-icon">🔒</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" type="password" />
              <span className="input-icon right">◌</span>
            </div>

            <label className="field-label">Confirm password</label>
            <div className="input-shell">
              <span className="input-icon">🔒</span>
              <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" type="password" />
              <span className="input-icon right">◌</span>
            </div>

            <div className="password-rules">
              <span className="rule ok">✓ At least 8 characters</span>
              <span className="rule ok">✓ One uppercase letter</span>
              <span className="rule ok">✓ One number</span>
            </div>

            <button type="submit" className="primary-submit">
              Create account
            </button>
          </form>

          <div className="divider"><span>or continue with</span></div>

          <div className="social-stack">
            <button type="button" className="social-btn">
              <span>◉</span>
              Continue with GitHub
            </button>
            <button type="button" className="social-btn">
              <span>G</span>
              Continue with Google
            </button>
          </div>

          <p className="terms-text">
            By creating an account, you agree to our <a href="/terms">Terms of Service</a>
            and <a href="/privacy">Privacy Policy</a>
          </p>
        </div>
      </div>
    </main>
  );
}
