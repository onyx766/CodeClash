"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Centered dialog over a dimmed backdrop. Escape or a click outside closes it.
 */
export function Modal({
  title,
  description,
  icon,
  onClose,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="fixed inset-0 -z-10 cursor-default"
        onClick={onClose}
      />
      <div className="panel w-full max-w-md overflow-hidden">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <p className="mt-0.5 text-[12px] text-dim">{description}</p>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
