"use client";

import { useState } from "react";
import { Clock, Gamepad2, Lock, Swords, Users, X } from "lucide-react";

export default function CreateRoomModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await onCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a room.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-[540px] max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-room-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="create-room-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
              Create Room
            </h2>
            <p className="mt-1.5 text-[13px] text-dim">
              Create a private room and invite your friends to battle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-dim hover:bg-white/5 hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-violet/60 bg-violet/8 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-deep text-white">
              <Users size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14.5px] font-bold">Private Room</h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet/40 bg-violet/15 px-2.5 py-1 text-[10.5px] font-bold text-violet-300">
                  <Lock size={10} /> Invite Only
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-dim">
                Create a room with a code and invite your friends.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-line bg-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted">
              <Gamepad2 size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14.5px] font-bold">Casual Match</h3>
                <span className="inline-flex items-center rounded-full border border-amber/40 bg-amber/15 px-2.5 py-1 text-[10.5px] font-bold uppercase text-amber-300">
                  Casual
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-dim">
                Private rooms are always casual. Play freely with friends — no rating changes, no
                pressure.
              </p>
            </div>
          </div>
        </div>

        {/* Battles are strictly 1v1 and the API decides the rest: no options to pick. */}
        <ul className="mt-5 space-y-2.5 text-[12.5px] text-muted">
          <li className="flex items-center gap-2.5">
            <Swords size={15} className="shrink-0 text-dim" /> 1v1 battle - you and one invited opponent.
          </li>
          <li className="flex items-center gap-2.5">
            <Clock size={15} className="shrink-0 text-dim" /> The room closes automatically if nobody joins in time.
          </li>
        </ul>

        {error && (
          <p className="mt-5 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost sm:w-auto"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="btn btn-violet sm:w-auto"
            disabled={submitting}
          >
            <Users size={15} />
            {submitting ? "Creating..." : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}
