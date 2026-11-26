"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Panel } from "../ui/Bits";
import { ApiError } from "../../lib/api";
import useAuth from "../../hooks/useAuth";

// POST /auth/change-password accepts new passwords of 8-128 characters.
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

type Problem = { field: "current" | "next" | "confirm" | null; text: string };

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  show,
  invalid,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  show: boolean;
  invalid: boolean;
  describedBy?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-muted">
        {label}
      </label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? describedBy : undefined}
          className={`field !py-2.5 !pl-9 ${invalid ? "!border-rose/60" : ""}`}
        />
      </div>
    </div>
  );
}

/** Change the account password; the API signs every other session out. */
export default function ChangePasswordPanel() {
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [changed, setChanged] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setChanged(false);
    setProblem(null);

    if (!current) return setProblem({ field: "current", text: "Enter your current password." });
    if (next.length < MIN_LENGTH) {
      return setProblem({ field: "next", text: `Your new password needs at least ${MIN_LENGTH} characters.` });
    }
    if (next.length > MAX_LENGTH) {
      return setProblem({ field: "next", text: `Your new password can be at most ${MAX_LENGTH} characters.` });
    }
    if (next !== confirm) return setProblem({ field: "confirm", text: "The new passwords do not match." });

    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setShow(false);
      setChanged(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CURRENT_PASSWORD") {
        setProblem({ field: "current", text: "Your current password is incorrect." });
      } else {
        setProblem({
          field: null,
          text: err instanceof ApiError ? err.message : "Your password could not be changed. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel id="change-password" title="Change Password" className="scroll-mt-24">
      <form onSubmit={submit} noValidate className="space-y-3">
        {/* Lets password managers file the new password under this account. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={user?.username ?? ""}
          readOnly
          hidden
        />
        <PasswordInput
          id="current-password"
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          show={show}
          invalid={problem?.field === "current"}
          describedBy="change-password-problem"
        />
        <PasswordInput
          id="new-password"
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          show={show}
          invalid={problem?.field === "next"}
          describedBy="change-password-problem"
        />
        <PasswordInput
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          show={show}
          invalid={problem?.field === "confirm"}
          describedBy="change-password-problem"
        />

        <label className="flex items-center gap-2 text-[12px] text-dim">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-blue" />
          Show passwords
        </label>

        {problem && (
          <p
            id="change-password-problem"
            role="alert"
            className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-300"
          >
            {problem.text}
          </p>
        )}
        {changed && (
          <p role="status" className="rounded-lg border border-green/30 bg-green/10 px-3 py-2 text-[12.5px] text-emerald-200">
            Your password was changed. Every other device or browser signed in to your account has been signed out;
            you stay signed in here.
          </p>
        )}

        <button type="submit" disabled={saving} className="btn btn-blue w-full !py-2.5 !text-[12.5px]">
          {saving ? "Changing…" : "Change Password"}
        </button>
      </form>
    </Panel>
  );
}
