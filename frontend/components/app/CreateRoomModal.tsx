"use client";

import { useState } from "react";
import { ChevronDown, Clock, Gamepad2, Info, Lock, Users, X } from "lucide-react";

export type CreateRoomOptions = {
  maxPlayers: number;
};

export default function CreateRoomModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (opts: CreateRoomOptions) => Promise<void>;
}) {
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [expiration, setExpiration] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await onCreate({ maxPlayers });
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

        <div className="mt-5">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-muted" htmlFor="player-limit">
            Player Limit
          </label>
          <div className="relative">
            <Users size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <select
              id="player-limit"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="field appearance-none pl-9 pr-9"
            >
              <option value={2}>2 players (1v1)</option>
              <option value={3}>3 players</option>
              <option value={4}>4 players</option>
            </select>
            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dim"
            />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            Rating Range (Optional)
            <Info size={13} className="text-dim" />
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-dim" htmlFor="min-rating">
                Minimum Rating
              </label>
              <input
                id="min-rating"
                type="number"
                inputMode="numeric"
                placeholder="Any (no limit)"
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-dim" htmlFor="max-rating">
                Maximum Rating
              </label>
              <input
                id="max-rating"
                type="number"
                inputMode="numeric"
                placeholder="Any (no limit)"
                value={maxRating}
                onChange={(e) => setMaxRating(e.target.value)}
                className="field"
              />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            Room Expiration
            <Info size={13} className="text-dim" />
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-[220px]">
              <Clock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <select
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className="field appearance-none pl-9 pr-9"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dim"
              />
            </div>
            <p className="text-[11.5px] text-dim">
              Room will be automatically closed if no one joins.
            </p>
          </div>
        </div>

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
