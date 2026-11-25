"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { IconSpinner } from "./Icons";

/** Small class-name joiner - no dependency needed for this. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-blue to-violet text-white border-transparent shadow-[0_6px_20px_-8px_rgba(59,130,246,0.9)] hover:brightness-110",
  secondary:
    "bg-panel-2 text-fg border-line hover:border-panel-3 hover:bg-panel-3",
  ghost: "bg-transparent text-muted border-transparent hover:text-fg hover:bg-panel-2",
  danger:
    "bg-rose/12 text-rose-300 border-rose/35 hover:bg-rose/20 hover:text-rose-200",
  success:
    "bg-gradient-to-r from-teal to-green text-[#04140d] border-transparent hover:brightness-110",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[10px] border font-semibold whitespace-nowrap",
        "transition-[background,border-color,filter,opacity] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
        size === "sm" ? "h-8 px-3 text-[12px]" : "h-10 px-4 text-[13px]",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? <IconSpinner size={15} /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={cx("panel", className)}>{children}</section>;
}

export function SectionHeader({
  icon,
  title,
  description,
  accent = "blue",
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  accent?: "blue" | "violet" | "teal" | "amber";
  action?: ReactNode;
}) {
  const accents = {
    blue: "from-blue/25 to-blue/5 text-blue-soft border-blue/25",
    violet: "from-violet/25 to-violet/5 text-violet-300 border-violet/25",
    teal: "from-teal/25 to-teal/5 text-teal-300 border-teal/25",
    amber: "from-amber/25 to-amber/5 text-amber-300 border-amber/25",
  } as const;

  return (
    <header className="flex items-start gap-3 border-b border-line px-5 py-4">
      <span
        className={cx(
          "grid size-9 shrink-0 place-items-center rounded-[10px] border bg-gradient-to-br",
          accents[accent],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] leading-5 font-semibold text-fg">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-4 text-dim">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-0.5 text-rose">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="field-error">{error}</p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx("input", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cx("input", className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function TextArea({
  invalid,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cx("input resize-y leading-relaxed", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Badges and status
// ---------------------------------------------------------------------------

type Tone = "neutral" | "blue" | "violet" | "green" | "amber" | "rose" | "teal";

const TONES: Record<Tone, string> = {
  neutral: "bg-panel-2 text-muted border-line",
  blue: "bg-blue/12 text-blue-soft border-blue/30",
  violet: "bg-violet/12 text-violet-300 border-violet/30",
  green: "bg-green/12 text-emerald-300 border-green/30",
  amber: "bg-amber/12 text-amber-300 border-amber/30",
  rose: "bg-rose/12 text-rose-300 border-rose/30",
  teal: "bg-teal/12 text-teal-300 border-teal/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const colors: Record<Tone, string> = {
    neutral: "bg-dim",
    blue: "bg-blue",
    violet: "bg-violet",
    green: "bg-green",
    amber: "bg-amber",
    rose: "bg-rose",
    teal: "bg-teal",
  };
  return <span className={cx("size-1.5 rounded-full", colors[tone])} />;
}

/** Inline error/success strip used above forms and action bars. */
export function Notice({
  tone = "rose",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[10px] border px-3 py-2 text-[12px] leading-relaxed",
        TONES[tone],
        className,
      )}
      role={tone === "rose" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selectable option card (creation mode / judge method)
// ---------------------------------------------------------------------------

export function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  accent = "blue",
  disabled,
  badge,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  accent?: "blue" | "violet" | "teal" | "amber";
  disabled?: boolean;
  badge?: ReactNode;
  name: string;
}) {
  const accents = {
    blue: "from-blue/20 to-blue/5 text-blue-soft border-blue/30",
    violet: "from-violet/20 to-violet/5 text-violet-300 border-violet/30",
    teal: "from-teal/20 to-teal/5 text-teal-300 border-teal/30",
    amber: "from-amber/20 to-amber/5 text-amber-300 border-amber/30",
  } as const;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      name={name}
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        "group relative flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60",
        selected
          ? "border-blue/60 bg-blue/8 shadow-[0_0_0_1px_rgba(59,130,246,0.25)_inset]"
          : "border-line bg-panel-2/50 hover:border-panel-3 hover:bg-panel-2",
        disabled && "cursor-not-allowed opacity-50 hover:border-line",
      )}
    >
      <span
        className={cx(
          "grid size-9 shrink-0 place-items-center rounded-[10px] border bg-gradient-to-br",
          accents[accent],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-fg">{title}</span>
          {badge}
        </span>
        <span className="mt-1 block text-[12px] leading-[1.5] text-dim">
          {description}
        </span>
      </span>
      <span
        className={cx(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
          selected ? "border-blue bg-blue" : "border-line-soft bg-transparent",
        )}
      >
        {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

export function Checkbox({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-fg select-none"
    >
      <span className="relative grid place-items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer size-[17px] cursor-pointer appearance-none rounded-[5px] border border-line bg-[rgba(4,8,18,0.6)] transition-colors checked:border-blue checked:bg-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60"
        />
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute size-3 opacity-0 peer-checked:opacity-100"
          fill="none"
          stroke="#fff"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4.5 12.5 5 5 10-11" />
        </svg>
      </span>
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (next: T) => void;
  tabs: { value: T; label: ReactNode }[];
}) {
  return (
    <div
      role="tablist"
      className="inline-flex gap-1 rounded-[10px] border border-line bg-[rgba(4,8,18,0.5)] p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12px] font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60",
            value === tab.value
              ? "bg-panel-3 text-fg"
              : "text-dim hover:text-muted",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Number stepper
// ---------------------------------------------------------------------------

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  id,
  invalid,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        className="input pr-9 mono"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : min);
        }}
      />
      <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 flex-col">
        <button
          type="button"
          aria-label="Increase"
          disabled={disabled}
          className="grid h-[15px] w-6 place-items-center rounded-t-[5px] text-dim hover:bg-panel-3 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onChange(clamp(value + step))}
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m6 15 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Decrease"
          disabled={disabled}
          className="grid h-[15px] w-6 place-items-center rounded-b-[5px] text-dim hover:bg-panel-3 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onChange(clamp(value - step))}
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </span>
    </div>
  );
}
