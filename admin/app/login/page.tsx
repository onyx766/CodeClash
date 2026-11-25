"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api";
import { postLoginPath, useAdminAuth } from "../../hooks/useAdminAuth";
import { usePlayerAppUrl } from "../../hooks/usePlayerAppUrl";
import {
  Button,
  Field,
  Notice,
  TextInput,
} from "../../components/ui/Primitives";
import {
  IconAlert,
  IconArrowRight,
  IconClock,
  IconEye,
  IconEyeOff,
  IconExternal,
  IconLock,
  IconLogo,
  IconMail,
  IconMatches,
  IconShield,
  IconSystem,
  IconTrophy,
  IconUsers,
} from "../../components/ui/Icons";

const FEATURES = [
  {
    icon: IconUsers,
    title: "User Management",
    body: "Search accounts, edit profiles, ban, reset passwords and manage roles.",
    accent: "from-blue/25 to-blue/5 text-blue-soft border-blue/25",
  },
  {
    icon: IconTrophy,
    title: "Challenge Authoring",
    body: "Write, import or generate challenges and validate them in the sandbox.",
    accent: "from-violet/25 to-blue/5 text-violet-300 border-violet/25",
  },
  {
    icon: IconMatches,
    title: "Battle Pool",
    body: "See which challenges matches can use, and why the others cannot.",
    accent: "from-violet/25 to-violet/5 text-violet-300 border-violet/25",
  },
  {
    icon: IconSystem,
    title: "Runner Status",
    body: "Check the code runner is reachable before validating or publishing.",
    accent: "from-teal/25 to-teal/5 text-teal-300 border-teal/25",
  },
] as const;

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, logout, user, isAdmin, loading, sessionExpired } =
    useAdminAuth();
  const playerAppUrl = usePlayerAppUrl();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in with a privileged account? Skip the form.
  useEffect(() => {
    if (!loading && user && isAdmin) {
      router.replace(postLoginPath() ?? "/");
    }
  }, [loading, user, isAdmin, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    // The credentials were accepted but the account cannot use the console:
    // end that session again rather than leave it signed in (the cookie is
    // shared with the player app in this browser).
    const reject = async (message: string) => {
      try {
        await logout();
      } catch {
        // Already signed out as far as the console is concerned.
      }
      setError(message);
    };

    try {
      const account = await login(email.trim(), password);
      if (!account?.role) {
        // Not a permission problem: /auth/me came back without the field,
        // which an out-of-date backend build does.
        await reject(
          "Signed in, but the API did not report this account's role. The backend may be running an older build — restart it and try again.",
        );
        return;
      }
      if (account.role !== "ADMIN" && account.role !== "MASTER") {
        await reject(
          `This account is a ${account.role} and does not have administrator access. Contact the platform owner.`,
        );
        return;
      }
      router.replace(postLoginPath() ?? "/");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Sign in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{ backgroundImage: "url(/grid.svg)", backgroundSize: "120px 120px" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-52 size-[620px] rounded-full bg-blue/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -bottom-52 size-[560px] rounded-full bg-violet/10 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-5 py-6 sm:px-8">
        {/* header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconLogo size={30} />
            <span className="text-[17px] font-bold tracking-tight">
              CodeClash
            </span>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="hidden text-[13px] font-semibold text-muted sm:block">
              Admin Console
            </span>
          </div>
          <a
            href={playerAppUrl}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[12px] font-semibold text-muted transition-colors hover:border-panel-3 hover:text-fg"
          >
            <IconExternal size={14} />
            Back to Main Site
          </a>
        </header>

        {/* body */}
        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_minmax(0,520px)] lg:gap-14">
          {/* marketing column */}
          <section className="hidden lg:block">
            <p className="eyebrow">Administrator Platform</p>
            <h1 className="mt-3 text-[44px] leading-[1.08] font-bold tracking-tight xl:text-[52px]">
              Control. Monitor. Keep
              <br />
              CodeClash{" "}
              <span className="bg-gradient-to-r from-blue to-violet bg-clip-text text-transparent">
                Running.
              </span>
            </h1>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
              A secure administration console for the challenges players
              compete on and the accounts they play with.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="panel p-4 transition-colors hover:border-panel-3"
                  >
                    <span
                      className={`grid size-9 place-items-center rounded-[10px] border bg-gradient-to-br ${feature.accent}`}
                    >
                      <Icon size={17} />
                    </span>
                    <h3 className="mt-3 text-[13.5px] font-semibold text-fg">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-[12px] leading-[1.5] text-dim">
                      {feature.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* sign-in card */}
          <section className="panel mx-auto w-full max-w-[520px] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <span className="grid size-11 place-items-center rounded-xl border border-blue/30 bg-gradient-to-br from-blue/25 to-violet/10 text-blue-soft">
                <IconShield size={22} />
              </span>
              <div className="text-right">
                <p className="eyebrow">Secure access only</p>
                <div className="mt-1.5 h-px w-full bg-gradient-to-l from-blue/60 to-transparent" />
              </div>
            </div>

            <h2 className="mt-5 text-[28px] leading-tight font-bold tracking-tight">
              Admin Console Sign In
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              Enter your credentials to access the CodeClash administration
              platform.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              {sessionExpired && !error ? (
                <Notice tone="amber">
                  <span className="flex items-start gap-2">
                    <IconClock size={15} className="mt-px shrink-0" />
                    Your session has expired. Sign in again to continue where
                    you left off.
                  </span>
                </Notice>
              ) : null}

              {error ? (
                <Notice tone="rose">
                  <span className="flex items-start gap-2">
                    <IconAlert size={15} className="mt-px shrink-0" />
                    {error}
                  </span>
                </Notice>
              ) : null}

              <Field label="Email Address" htmlFor="admin-email">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
                    <IconMail size={16} />
                  </span>
                  <TextInput
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    required
                    className="pl-10"
                    placeholder="admin@yourcompany.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </Field>

              <Field label="Password" htmlFor="admin-password">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
                    <IconLock size={16} />
                  </span>
                  <TextInput
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="px-10"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((shown) => !shown)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-dim transition-colors hover:text-fg"
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </Field>

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                className="h-11 w-full text-[14px]"
                iconRight={<IconArrowRight size={16} />}
              >
                Sign In to Dashboard
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="eyebrow">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <p className="mt-4 text-center text-[12.5px] text-dim">
              Contact the platform owner for an administrator account.
            </p>
            <p className="mt-1.5 text-center text-[11.5px] leading-relaxed text-faint">
              The console and the player app share one sign-in per browser. Use
              a separate browser profile or a private window for admin work.
            </p>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber/25 bg-amber/8 p-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-amber/30 bg-amber/12 text-amber-300">
                <IconLock size={15} />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold text-amber-300">
                  Restricted to authorized administrators only.
                </p>
                <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
                  The API checks your role on every request, and sign-in
                  attempts are rate-limited.
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-4 text-[11.5px] text-dim">
          <span>© {new Date().getFullYear()} CodeClash. All rights reserved.</span>
          <span className="text-faint">•</span>
          <span>Admin Console</span>
        </footer>
      </div>
    </div>
  );
}
