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
import { rooms, ApiError } from "../../../lib/api";
import { ACTIVE_MATCH_STATUSES, type MatchStatus } from "../../../lib/battle";
import useAuth from "../../../hooks/useAuth";
import { currentUser } from "../../../lib/demo";
import { Avatar, avatarForUserId } from "../../../components/ui/Bits";

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
  status?: string;
  match?: { id: string; status: MatchStatus } | null;
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
  const [startError, setStartError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const { user, clearActiveRoom } = useAuth();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    rooms
      .get(roomId)
      .then((data: Room) => {
        // The match has already started (e.g. after a refresh) - rejoin it.
        if (data.match && ACTIVE_MATCH_STATUSES.includes(data.match.status)) {
          router.replace(`/match/${data.match.id}`);
          return;
        }
        setRoom(data);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          clearActiveRoom();
          router.replace("/lobby");
        }
      });
    const s = getSocket();
    // Sent to both players' user channels when the host starts the match.
    const onMatchStarted = (payload: { matchId?: string }) => {
      if (payload?.matchId) router.push(`/match/${payload.matchId}`);
    };
    s.on("match:started", onMatchStarted);
    s.emit("room:join", { roomId });
    s.on("room:update", (payload: { room?: Room | null }) => {
      if (payload.room) {
        setRoom(payload.room);
      } else if (payload.room === null) {
        // The room was cancelled or emptied out from under us (e.g. the host
        // left) - bounce back to the lobby instead of showing stale state.
        clearActiveRoom();
        router.replace("/lobby");
      }
    });
    return () => {
      s.emit("room:leave", { roomId });
      s.off("room:update");
      s.off("match:started", onMatchStarted);
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
    if (!room) return;
    setStarting(true);
    setStartError("");
    try {
      const res = (await rooms.start(room.code)) as { match: { id: string } };
      router.push(`/match/${res.match.id}`);
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : "Could not start the match.");
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
      <div className="cc-container flex h-screen items-center justify-center overflow-hidden">
        <p className="text-[13px] text-dim">Loading room…</p>
      </div>
    );
  }

  const slots = Array.from({ length: room.maxPlayers }, (_, i) => room.players[i] ?? null);

  return (
    <div className="cc-container flex h-screen flex-col overflow-hidden py-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Link
          href="/lobby"
          className="flex items-center gap-2 text-[13px] font-medium text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={15} /> Back to Lobby
        </Link>
        <button type="button" className="btn btn-ghost !px-3.5 !py-2 !text-[12px]">
          <Settings size={13} /> Room Settings
        </button>
      </div>

      <section className="card mt-2.5 shrink-0 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-deep text-white">
              <Lock size={16} />
            </span>
            <h1 className="text-[15px] font-bold">Private Room</h1>
          </div>
          <span className="flex items-center gap-2 text-[12px] font-semibold text-emerald-400">
            <span className="dot-live" /> {isFull ? "Ready to start!" : "Waiting for opponent…"}
          </span>
        </div>

        <div className="mt-2.5 text-center">
          <p className="eyebrow !text-[10px]">Room Code</p>
          <p className="mt-1 text-[32px] font-extrabold leading-none tracking-[0.08em]">{room.code}</p>

          <div className="mt-3 flex flex-col justify-center gap-2.5 sm:flex-row">
            <button type="button" onClick={copyCode} className="btn btn-violet !py-2 sm:w-auto sm:min-w-[160px]">
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              {copiedCode ? "Copied!" : "Copy Code"}
            </button>
            <button type="button" onClick={copyInviteLink} className="btn btn-ghost !py-2 sm:w-auto sm:min-w-[160px]">
              {copiedLink ? <Check size={14} /> : <Link2 size={14} />}
              {copiedLink ? "Copied!" : "Copy Invite Link"}
            </button>
          </div>
        </div>
      </section>

      <div className="mt-2.5 grid shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { icon: Gamepad2, label: "Mode", value: room.mode === "CASUAL" ? "Casual Match" : "Match" },
          { icon: Users, label: "Players", value: `${room.players.length} / ${room.maxPlayers}` },
          { icon: BarChart3, label: "Level Range", value: "Any Level" },
          { icon: Clock, label: "Expires In", value: remainingLabel },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-2.5 p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted">
              <s.icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-[10.5px] text-dim">{s.label}</span>
              <span className="block truncate text-[13px] font-bold">{s.value}</span>
            </span>
          </div>
        ))}
      </div>

      <section className="card mt-2.5 flex min-h-0 flex-1 flex-col overflow-hidden p-3.5">
        <h2 className="shrink-0 text-[13px] font-bold">
          Players ({room.players.length}/{room.maxPlayers})
        </h2>
        <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-2 gap-3">
          {slots.map((player, i) => {
            const isHostPlayer = player?.userId === room.hostId;
            return player ? (
              <div
                key={player.id}
                className={`flex min-h-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border p-2 text-center ${
                  isHostPlayer ? "border-violet/40 bg-violet/10" : "card-soft"
                }`}
              >
                <span
                  className={`mb-1 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isHostPlayer ? "bg-violet/25 text-violet-200" : "bg-white/5 text-dim"
                  }`}
                >
                  {isHostPlayer && <Crown size={11} className="text-amber" />}
                  {isHostPlayer ? "Host" : "Challenger"}
                </span>
                <Avatar
                  src={player.userId === user?.id ? currentUser.avatar : avatarForUserId(player.userId)}
                  alt={player.user?.username ?? "Player"}
                  size={92}
                  ring={isHostPlayer}
                  className="shrink-0"
                />
                <p className="mt-1 flex shrink-0 flex-wrap items-center justify-center gap-1.5 text-[15px] font-bold">
                  {player.user?.username ?? "Unknown"}
                </p>
                {player.userId === user?.id && (
                  <p className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-violet-300">
                    <Gem size={12} /> {currentUser.rating}
                  </p>
                )}
              </div>
            ) : isHost ? (
              <div
                key={`invite-${i}`}
                className="flex min-h-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed border-violet/40 bg-violet/5 p-3 text-center"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet/20 text-violet-300">
                  <Send size={17} />
                </span>
                <p className="shrink-0 text-[13.5px] font-bold">Invite a Friend</p>
                <p className="hidden shrink-0 text-[11px] text-dim sm:block">
                  Share the room code above, or invite by username
                </p>
                <form onSubmit={invite} className="mt-1 flex w-full max-w-[220px] shrink-0 flex-col gap-1.5">
                  <input
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Enter a username…"
                    aria-label="Friend's username"
                    className="field !py-1.5 !text-[12px]"
                  />
                  <button
                    type="submit"
                    disabled={!inviteInput.trim() || inviteSending}
                    className="btn btn-violet w-full !py-1.5 !text-[12px]"
                  >
                    <Send size={12} /> {inviteSending ? "Sending…" : "Send Invite"}
                  </button>
                </form>
                {inviteMessage && <p className="shrink-0 text-[10.5px] text-dim">{inviteMessage}</p>}
              </div>
            ) : (
              <div
                key={`empty-${i}`}
                className="flex min-h-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border border-dashed border-line p-2 text-center"
              >
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-dim">
                  <Plus size={26} />
                </span>
                <p className="mt-1.5 shrink-0 text-[13.5px] font-semibold text-muted">Waiting for opponent…</p>
              </div>
            );
          })}
        </div>
      </section>

      {startError && (
        <p className="mt-2.5 shrink-0 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-200">
          {startError}
        </p>
      )}

      <div className="mt-2.5 flex shrink-0 gap-2.5">
        {isHost && isFull && (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="btn btn-blue flex-1 !py-2.5 !text-[13px]"
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
              ? "flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose/40 bg-rose/10 py-2.5 text-[13px] font-bold text-rose-300 transition-colors hover:bg-rose/15 disabled:opacity-60"
              : "btn btn-ghost flex-1 !py-2.5 !text-[13px] disabled:opacity-60"
          }
        >
          <XCircle size={14} />
          {leaving ? "Leaving…" : isHost ? "Cancel Room" : "Leave Room"}
        </button>
      </div>
    </div>
  );
}
