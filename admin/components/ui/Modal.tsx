"use client";

import { useEffect, type ReactNode } from "react";
import { Button, Notice } from "./Primitives";
import { IconAlert } from "./Icons";

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

/**
 * Asks before an action that cannot be taken back. The caller owns the busy
 * and error state, so a refusal from the server is shown in the dialog,
 * where the admin is looking, instead of somewhere off-screen.
 */
export function ConfirmDialog({
  title,
  description,
  icon,
  confirmLabel,
  confirmIcon,
  danger,
  busy,
  error,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal title={title} description={description} icon={icon} onClose={onCancel}>
      <div className="space-y-4 p-5">
        {error ? (
          <Notice tone="rose">
            <span className="flex items-start gap-2">
              <IconAlert size={15} className="mt-px shrink-0" />
              {error}
            </span>
          </Notice>
        ) : null}

        {children}

        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            icon={confirmIcon}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
