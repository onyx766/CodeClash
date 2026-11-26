"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import AuthLayout from "../../components/auth/AuthLayout";
import { AuthCardHeader } from "../../components/auth/AuthCard";
import useAuth from "../../hooks/useAuth";
import useSearchParam from "../../hooks/useSearchParam";
import { authErrorMessage } from "../../lib/authErrors";
import { authHref, safeNextPath } from "../../lib/navigation";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  // Only ever a path on this site: never an open redirect.
  const next = safeNextPath(useSearchParam("next"), "");
  // Why the last session ended, when the app signed the player out itself.
  const banned = useSearchParam("banned") === "1";
  const expired = useSearchParam("expired") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const { activeRoom } = await login(email, password);
      router.push(activeRoom ? `/rooms/${activeRoom.id}` : next || "/lobby");
    } catch (err) {
      setError(authErrorMessage(err, "Invalid email or password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      highlight="Challenger"
      subtitle="Sign in to continue your coding journey, compete in live battles, and climb the leaderboard."
    >
      <div className="card p-6 sm:p-7">
        <AuthCardHeader title="Sign in" subtitle="Enter your details to access your account." />

        {(banned || expired) && !error && (
          <p
            role={banned ? "alert" : "status"}
            className={`mt-5 rounded-lg border px-3 py-2 text-[12.5px] ${
              banned ? "border-rose/30 bg-rose/10 text-rose-300" : "border-blue/30 bg-blue/10 text-blue-200"
            }`}
          >
            {banned ? "This account has been suspended." : "Your session has expired. Please sign in again."}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
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
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dim transition-colors hover:text-fg"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <p className="text-[12px] text-dim">Forgot your password? An administrator can reset it for you.</p>

          {error && (
            <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-grad w-full !py-3">
            {busy ? "Signing in…" : "Sign In"} <ArrowRight size={15} />
          </button>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-dim">
          New to CodeClash? <Link href={authHref("/register", next)} className="font-semibold text-blue-400 hover:underline">Create an account</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
