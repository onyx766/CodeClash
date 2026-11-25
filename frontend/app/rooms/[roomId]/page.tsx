"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Check,
  Clock,
  Copy,
  Crown,
  Gamepad2,
  Gem,
  Link2,
  Lock,
  Mail,
  Plus,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import { joinChannel, onEveryConnect } from "../../../lib/socket";
import { rooms, ApiError } from "../../../lib/api";
import { ACTIVE_MATCH_STATUSES, type MatchStatus } from "../../../lib/battle";
import useAuth from "../../../hooks/useAuth";
import useProfile from "../../../hooks/useProfile";
import useSocket from "../../../hooks/useSocket";
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
  const [loadError, setLoadError] = useState("");
  // The host cancelled the room while we were in it.
  const [closed, setClosed] = useState(false);
  // "<user> accepted/declined your invitation."
  const [notice, setNotice] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const { user, clearActiveRoom } = useAuth();
  const { profileUser, stats } = useProfile();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  // invitationId -> username, to name the player in invitation:updated.
  const invitedRef = useRef<Record<string, string>>({});

  const socket = useSocket();

  // Shows the room while it is still a waiting room; otherwise moves on.
  const applyRoom = useCallback(
    (data: Room) => {
      if (data.match && ACTIVE_MATCH_STATUSES.includes(data.match.status)) {
        // The match has started (e.g. after a refresh, or a missed match:started).
        router.replace(`/match/${data.match.id}`);
        return;
      }
      if (data.status === "FINISHED" || data.match) {
        // Its match is over: nothing to wait for here any more.
        clearActiveRoom();
        router.replace("/lobby");
        return;
      }
      // Pushed snapshots carry no presentation metadata; keep what GET gave us.
      setRoom((prev) => ({ ...data, mode: data.mode ?? prev?.mode }));
    },
    [router, clearActiveRoom],
  );

  const load = useCallback(
    () =>
      rooms.get(roomId).then(
        (data: Room) => {
          setLoadError("");
          applyRoom(data);
        },
        (err: unknown) => {
          if (err instanceof ApiError && err.status === 404) {
            // Cancelled, expired or not ours - unless we are the ones leaving it.
            if (!leavingRef.current) {
              clearActiveRoom();
              router.replace("/lobby");
            }
            return;
          }
          setLoadError(err instanceof ApiError ? err.message : "Could not load this room.");
        },
      ),
    [roomId, applyRoom, clearActiveRoom, router],
  );

  // HTTP is the source of truth: load now, then every 5 s in case a push was
  // missed (e.g. while the socket was reconnecting).
  useEffect(() => {
    if (closed) return;
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load, closed]);

  useEffect(() => {
    if (!socket) return;
    // Sent to both players' user channels when the host starts the match.
    const onMatchStarted = (payload: { matchId?: string }) => {
      if (payload?.matchId) router.push(`/match/${payload.matchId}`);
    };
    const onRoomUpdate = (payload: { room?: Room | null }) => {
      if (payload.room === null) {
        // The room no longer exists: the host cancelled it, or it emptied
        // out. Our own leave/cancel navigates by itself.
        if (leavingRef.current) return;
        clearActiveRoom();
        setClosed(true);
      } else if (payload.room && payload.room.id === roomId) {
        applyRoom(payload.room);
      }
    };
    const onInvitationUpdated = (payload: { invitationId?: string; roomId?: string; status?: string }) => {
      if (payload?.roomId !== roomId) return;
      const name = (payload.invitationId && invitedRef.current[payload.invitationId]) || "Your friend";
      setNotice(`${name} ${payload.status === "ACCEPTED" ? "accepted" : "declined"} your invitation.`);
      if (payload.status === "ACCEPTED") void load();
    };
    // Room subscriptions belong to one connection: join again after every
    // reconnect, and on a new socket after login or a session refresh.
    let stopJoin = () => {};
    const stopConnect = onEveryConnect(socket, () => {
      stopJoin();
      stopJoin = joinChannel(socket, "room:join", { roomId });
    });
    socket.on("match:started", onMatchStarted);
    socket.on("room:update", onRoomUpdate);
    socket.on("invitation:updated", onInvitationUpdated);
    return () => {
      stopConnect();
      stopJoin();
      if (socket.connected) socket.emit("room:leave", { roomId });
      socket.off("room:update", onRoomUpdate);
      socket.off("match:started", onMatchStarted);
      socket.off("invitation:updated", onInvitationUpdated);
    };
  }, [socket, roomId, router, clearActiveRoom, applyRoom, load]);

  // Let the player read why before returning them to the lobby.
  useEffect(() => {
    if (!closed) return;
    const t = setTimeout(() => router.replace("/lobby"), 3000);
    return () => clearTimeout(t);
  }, [closed, router]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);

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
    leavingRef.current = true;
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
    const username = inviteInput.trim();
    try {
      const invitation = (await rooms.invite(roomId, username)) as { id?: string };
      if (invitation?.id) invitedRef.current[invitation.id] = username;
      setInviteMessage(`Invite sent to ${username}.`);
      setInviteInput("");
    } catch (err) {
      setInviteMessage(err instanceof ApiError ? err.message : "Could not send invite.");
    } finally {
      setInviteSending(false);
    }
  };

  if (closed) {
    return (
      <div className="cc-container flex h-screen items-center justify-center overflow-hidden">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-[18px] font-bold">Room closed</h1>
          <p className="mt-2 text-[14px] text-muted">The host cancelled this room. Taking you back to the lobby…</p>
          <Link href="/lobby" className="btn btn-blue mt-5">
            Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="cc-container flex h-screen items-center justify-center overflow-hidden">
        {loadError ? (
          <div className="card max-w-md p-6 text-center">
            <h1 className="text-[18px] font-bold">Room unavailable</h1>
            <p className="mt-2 text-[14px] text-muted">{loadError} Retrying…</p>
          </div>
        ) : (
          <p className="text-[13px] text-dim">Loading room…</p>
        )}
      </div>
    );
  }

  const slots = Array.from({ length: room.maxPlayers }, (_, i) => room.players[i] ?? null);

  return (
    <div className="cc-container flex h-screen flex-col overflow-hidden py-3">
      {notice && (
        <p
          role="status"
          className="mb-2.5 flex shrink-0 items-center gap-2 rounded-lg border border-violet/30 bg-violet/10 px-3 py-2 text-[12.5px] text-violet-200"
        >
          <Mail size={14} /> {notice}
        </p>
      )}

      <section className="card shrink-0 p-3.5 sm:p-4">
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
                  src={
                    (player.userId === user?.id && profileUser?.avatarUrl) || avatarForUserId(player.userId)
                  }
                  alt={player.user?.username ?? "Player"}
                  size={92}
                  ring={isHostPlayer}
                  className="shrink-0"
                />
                <p className="mt-1 flex shrink-0 flex-wrap items-center justify-center gap-1.5 text-[15px] font-bold">
                  {player.user?.username ?? "Unknown"}
                </p>
                {player.userId === user?.id && stats && (
                  <p className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-violet-300">
                    <Gem size={12} /> {stats.rating}
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
