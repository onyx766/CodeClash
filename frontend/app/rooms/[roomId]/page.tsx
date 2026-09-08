"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock,
  Copy,
  Crown,
  Gamepad2,
  Gem,
  Link2,
  Lock,
  Plus,
  Send,
  Settings,
  Users,
  XCircle,
} from "lucide-react";
import { getSocket } from "../../../lib/socket";
import { rooms, matches, ApiError } from "../../../lib/api";
import useAuth from "../../../hooks/useAuth";
import { currentUser } from "../../../lib/demo";
import { Avatar } from "../../../components/ui/Bits";

type RoomPlayer = {
  id: string;
  userId: string;
  isReady?: boolean;
  user?: { id: string; username: string };
};

type Room = {
  id: string;
  code: string;
  hostId: string;
  maxPlayers: number;
  mode?: string;
  createdAt?: string;
  expiresAt?: string | null;
  players: RoomPlayer[];
};

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [room, setRoom] = useState<Room | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { user, clearActiveRoom } = useAuth();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    rooms.get(roomId).then(setRoom).catch(() => {});
    const s = getSocket();
    s.emit("room:join", { roomId });
    s.on("room:update", (payload: { room?: Room }) => {
      if (payload.room) setRoom(payload.room);
    });
    return () => {
      s.emit("room:leave", { roomId });
      s.off("room:update");
    };
  }, [roomId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isHost = Boolean(user?.id && room?.hostId === user.id);
  const isFull = Boolean(room && room.players.length >= room.maxPlayers);
  const expiresAt = room?.expiresAt ? new Date(room.expiresAt).getTime() : null;
  const remainingLabel = expiresAt ? formatCountdown(expiresAt - now) : "--:--";

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // clipboard unavailable - nothing to fall back to
    }
  };

  const copyInviteLink = async () => {
    if (!room || typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lobby?code=${room.code}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // clipboard unavailable - nothing to fall back to
    }
  };

  const start = async () => {
    setStarting(true);
    try {
      await matches.start(roomId);
    } catch {
      alert("Could not start the match.");
    } finally {
      setStarting(false);
    }
  };

  const leaveRoom = async () => {
    setLeaving(true);
    try {
      await rooms.leave(roomId);
    } catch {
      // room may already be gone - navigate away regardless
    } finally {
      clearActiveRoom();
      router.push("/lobby");
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage("");
    setInviteSending(true);
    try {
      await rooms.invite(roomId, inviteInput.trim());
      setInviteMessage(`Invite sent to ${inviteInput.trim()}.`);
      setInviteInput("");
    } catch (err) {
      setInviteMessage(err instanceof ApiError ? err.message : "Could not send invite.");
    } finally {
      setInviteSending(false);
    }
  };

  if (!room) {
    return (
      <div className="cc-container flex min-h-screen items-center justify-center py-10">
        <p className="text-[13px] text-dim">Loading room…</p>
      </div>
    );
  }

  const slots = Array.from({ length: room.maxPlayers }, (_, i) => room.players[i] ?? null);

  return (
    <div className="cc-container min-h-screen py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/lobby"
          className="flex items-center gap-2 text-[13.5px] font-medium text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={16} /> Back to Lobby
        </Link>
        <button type="button" className="btn btn-ghost !px-4 !py-2.5 !text-[12.5px]">
          <Settings size={14} /> Room Settings
        </button>
      </div>

      <section className="card mt-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-deep text-white">
              <Lock size={20} />
            </span>
            <h1 className="text-[18px] font-bold">Private Room</h1>
          </div>
          <span className="flex items-center gap-2 text-[12.5px] font-semibold text-emerald-400">
            <span className="dot-live" /> {isFull ? "Ready to start!" : "Waiting for opponent…"}
          </span>
        </div>

        <div className="mt-8 text-center">
          <p className="eyebrow">Room Code</p>
          <p className="mt-3 text-[52px] font-extrabold leading-none tracking-[0.08em]">{room.code}</p>
          <p className="mt-3 text-[13px] text-dim">Share this code or invite link with your friend to join the room.</p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={copyCode} className="btn btn-violet sm:w-auto sm:min-w-[180px]">
              {copiedCode ? <Check size={15} /> : <Copy size={15} />}
              {copiedCode ? "Copied!" : "Copy Code"}
            </button>
            <button type="button" onClick={copyInviteLink} className="btn btn-ghost sm:w-auto sm:min-w-[180px]">
              {copiedLink ? <Check size={15} /> : <Link2 size={15} />}
              {copiedLink ? "Copied!" : "Copy Invite Link"}
            </button>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Gamepad2, label: "Mode", value: room.mode === "CASUAL" ? "Casual Match" : "Match" },
          { icon: Users, label: "Players", value: `${room.players.length} / ${room.maxPlayers}` },
          { icon: BarChart3, label: "Level Range", value: "Any Level" },
          { icon: Clock, label: "Expires In", value: remainingLabel },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted">
              <s.icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11.5px] text-dim">{s.label}</span>
              <span className="block truncate text-[15px] font-bold">{s.value}</span>
            </span>
          </div>
        ))}
      </div>

      <section className="card mt-4 border-violet/30 bg-violet/5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet/20 text-violet-300">
              <Send size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold">Invite a Friend</h2>
              <p className="mt-0.5 text-[12.5px] text-dim">Send an invite directly by username.</p>
            </div>
          </div>
          <form onSubmit={invite} className="flex flex-1 flex-col gap-2 sm:max-w-[420px] sm:flex-row">
            <input
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Enter a username…"
              aria-label="Friend's username"
              className="field"
            />
            <button
              type="submit"
              disabled={!inviteInput.trim() || inviteSending}
              className="btn btn-violet sm:w-auto"
            >
              <Send size={14} /> {inviteSending ? "Sending…" : "Send Invite"}
            </button>
          </form>
        </div>
        {inviteMessage && <p className="mt-3 text-[12.5px] text-dim">{inviteMessage}</p>}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-[15px] font-bold">
          Players ({room.players.length}/{room.maxPlayers})
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {slots.map((player, i) =>
            player ? (
              <div key={player.id} className="card-soft flex flex-col items-center p-5 text-center">
                <Avatar
                  src={player.userId === user?.id ? currentUser.avatar : "/img/avatars/avatar-3.png"}
                  alt={player.user?.username ?? "Player"}
                  size={64}
                />
                <p className="mt-3 flex items-center gap-1.5 text-[15px] font-bold">
                  {player.user?.username ?? "Unknown"}
                  {player.userId === room.hostId && <Crown size={15} className="text-amber" />}
                </p>
                {player.userId === user?.id && (
                  <p className="mt-1 flex items-center gap-1 text-[12.5px] font-semibold text-violet-300">
                    <Gem size={13} /> {currentUser.rating}
                  </p>
                )}
                {player.userId === room.hostId && (
                  <span className="mt-2 rounded-md bg-violet/20 px-2.5 py-1 text-[11px] font-bold text-violet-300">
                    Host
                  </span>
                )}
              </div>
            ) : (
              <div
                key={`empty-${i}`}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line p-5 text-center"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-line text-dim">
                  <Plus size={22} />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-muted">Waiting for opponent…</p>
                <p className="mt-1 text-[12px] text-dim">Share the room code or send an invite to get started!</p>
              </div>
            ),
          )}
        </div>
      </section>

      {isHost && isFull && (
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="btn btn-blue mt-4 w-full !py-3.5 !text-[14px]"
        >
          {starting ? "Starting…" : "Start Match"}
        </button>
      )}

      <button
        type="button"
        onClick={leaveRoom}
        disabled={leaving}
        className={
          isHost
            ? "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-rose/40 bg-rose/10 py-3.5 text-[14px] font-bold text-rose-300 transition-colors hover:bg-rose/15 disabled:opacity-60"
            : "btn btn-ghost mt-4 w-full !py-3.5 !text-[14px] disabled:opacity-60"
        }
      >
        <XCircle size={16} />
        {leaving ? "Leaving…" : isHost ? "Cancel Room" : "Leave Room"}
      </button>
    </div>
  );
}
