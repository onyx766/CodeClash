"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import AuthLayout from "../../components/auth/AuthLayout";
import { AuthCardHeader, SocialAuth } from "../../components/auth/AuthCard";
import { ApiError } from "../../lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    setBusy(true);
    try {
      await register(email, username, password);
      router.push("/lobby");
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setError(err.message);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Join the Arena"
      highlight="Challenger"
      subtitle="Create your account and start coding battles, climb the leaderboard, and join a community of developers worldwide."
    >
      <div className="card p-6 sm:p-7">
        <AuthCardHeader title="Create Account" subtitle="Start your coding journey. The arena awaits." />

        <form onSubmit={handle} className="mt-6 space-y-3.5">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-[12px] font-semibold text-muted">
              Username
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input
                id="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="field !pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-[12px] font-semibold text-muted">
              Email Address
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="field !pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[12px] font-semibold text-muted">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="field !pl-9 !pr-10"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dim transition-colors hover:text-fg"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-[12px] font-semibold text-muted">
              Confirm Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm your password"
                className="field !pl-9 !pr-10"
              />
              <button
                type="button"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dim transition-colors hover:text-fg"
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 pt-1 text-[12.5px] text-muted">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-blue)]"
            />
            <span>
              I agree to the <span className="font-medium text-blue-400">Terms of Service</span> and <span className="font-medium text-blue-400">Privacy Policy</span>
            </span>
          </label>

          {error && (
            <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-grad w-full !py-3">
            {busy ? "Creating account…" : "Create Account"} <ArrowRight size={15} />
          </button>
        </form>

        <SocialAuth />

        <p className="mt-5 text-center text-[12.5px] text-dim">
          Already have an account? <Link href="/login" className="font-semibold text-blue-400 hover:underline">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
