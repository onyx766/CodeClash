"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, PlayCircle, Plus, RotateCcw, Swords, Users, X, Zap } from "lucide-react";
import { ApiError, rooms as roomsApi } from "../../lib/api";
import AppLayout from "../../components/layout/AppLayout";
import DashboardSidebar from "../../components/app/DashboardSidebar";
import LobbyRail from "../../components/app/LobbyRail";
import CreateRoomModal from "../../components/app/CreateRoomModal";
import MyInvitations from "../../components/app/MyInvitations";
import QuickMatchCard from "../../components/app/QuickMatchCard";
import useActiveMatch from "../../hooks/useActiveMatch";
import useAuth from "../../hooks/useAuth";
import useProfile from "../../hooks/useProfile";
import useQuickMatch from "../../hooks/useQuickMatch";
import useSearchParam from "../../hooks/useSearchParam";

export default function LobbyPage() {
  const router = useRouter();
  // An invite link (/lobby?code=...) opens the join form pre-filled until the
  // player edits it. Read through useSearchParam: on a client-side navigation
  // (e.g. right after signing in) window.location still holds the previous
  // URL during the first render.
  const invitedCode = useSearchParam("code")?.toUpperCase() ?? null;
  const [codeInput, setCodeInput] = useState<string | null>(null);
  const code = codeInput ?? invitedCode ?? "";
  const [joinToggled, setJoinToggled] = useState<boolean | null>(null);
  const joinOpen = joinToggled ?? Boolean(invitedCode);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState("");
  const quickMatch = useQuickMatch();
  const { refreshActiveRoom } = useAuth();
  const { refetch: refetchProfile } = useProfile();
  // Bumped when a match ends, so Recent Activity re-reads the history.
  const [historyVersion, setHistoryVersion] = useState(0);

  // Stats change with every finished match: never show the ones cached
  // from before the last game.
  useEffect(() => {
    void refetchProfile();
  }, [refetchProfile]);

  // A match the player left (e.g. via the logo) - offer the way back, and
  // pick up its result if it ends while they are here.
  const onMatchEnded = useCallback(() => {
    void refetchProfile();
    void refreshActiveRoom();
    setHistoryVersion((n) => n + 1);
  }, [refetchProfile, refreshActiveRoom]);
  const activeMatch = useActiveMatch(onMatchEnded);

  const createRoom = async () => {
    const r = await roomsApi.create();
    setCreateOpen(false);
    router.push(`/rooms/${r.id}`);
  };

  const join = async (roomCode: string) => {
    setError("");
    if (!roomCode) {
      setJoinToggled(true);
      return;
    }
    try {
      const res = await roomsApi.join(roomCode);
      router.push(`/rooms/${res.room.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Could not join room ${roomCode}.`);
    }
  };

  const cards = [
    {
      key: "create",
      icon: Users,
      title: "Create Room",
      desc: "Create a private room and invite your friends.",
      cta: "Create Room",
      btn: "btn-violet",
      onClick: () => setCreateOpen(true),
      ring: "from-[#1a1140] to-[#0b1020] border-violet/30",
      badge: "from-violet to-violet-deep",
      ctaIcon: Plus,
      foot: (
        <>
          <Users size={13} /> Invite your friends
        </>
      ),
    },
    {
      key: "join",
      icon: LogIn,
      title: "Join Room",
      desc: "Enter a room code to join your friend's battle.",
      cta: "Join Room",
      btn: "btn-outline-green",
      onClick: () => setJoinToggled(!joinOpen),
      ring: "from-[#0c2020] to-[#0b1020] border-teal/30",
      badge: "from-teal to-green",
      ctaIcon: LogIn,
      foot: (
        <>
          <LogIn size={13} /> Have a room code?
        </>
      ),
    },
  ];

  return (
    <AppLayout sidebar={<DashboardSidebar />} rail={<LobbyRail key={historyVersion} />}>
      <CreateRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createRoom}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Lobby 👋</h1>
          <p className="mt-1.5 text-[13px] text-dim">
            Challenge developers, improve your skills, climb the leaderboard.
          </p>
        </div>
        <Link href="/how-it-works" className="btn btn-ghost !py-2.5 !text-[12.5px]">
          <PlayCircle size={15} /> How Lobby Works
        </Link>
      </header>

      {activeMatch && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue/35 bg-blue/10 px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-blue-200">
            <Swords size={16} />
            {activeMatch.status === "IN_PROGRESS"
              ? "You have a match in progress."
              : "A match is waiting for you to accept it."}
          </p>
          <Link href={`/match/${activeMatch.id}`} className="btn btn-blue !px-4 !py-2 !text-[12.5px]">
            {activeMatch.status === "IN_PROGRESS" ? "Return to match" : "Open match"}
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <QuickMatchCard />
        {cards.map((c) => (
          <div
            key={c.key}
            className={`card flex flex-col items-center bg-gradient-to-b p-5 text-center ${c.ring}`}
          >
            <span
              className={`inline-flex h-[62px] w-[62px] items-center justify-center rounded-full bg-gradient-to-br ${c.badge} text-white shadow-lg`}
            >
              <c.icon size={26} strokeWidth={2.2} />
            </span>
            <h2 className="mt-4 text-[17px] font-bold">{c.title}</h2>
            <p className="mx-auto mt-2 max-w-[220px] text-[12.5px] leading-relaxed text-dim">
              {c.desc}
            </p>
            <button type="button" onClick={c.onClick} className={`btn ${c.btn} mt-5 w-full`}>
              {c.ctaIcon ? <c.ctaIcon size={15} /> : <Zap size={15} />}
              {c.cta}
            </button>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-dim">
              {c.foot}
            </p>
          </div>
        ))}
      </div>

      {joinOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            join(code.trim().toUpperCase());
          }}
          className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row"
        >
          <input
            value={code}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Enter room code (e.g. AB12CD)"
            aria-label="Room code"
            className="field"
          />
          <button type="submit" className="btn btn-blue sm:w-40">
            Join
          </button>
        </form>
      )}

      {quickMatch.notice && (
        <div
          role={quickMatch.notice.tone === "error" ? "alert" : "status"}
          className={`mt-4 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-[12.5px] ${
            quickMatch.notice.tone === "error"
              ? "border-rose/30 bg-rose/10 text-rose-300"
              : "border-blue/30 bg-blue/10 text-blue-200"
          }`}
        >
          <span className="min-w-0 flex-1">{quickMatch.notice.text}</span>
          {quickMatch.notice.action && (
            <Link href={quickMatch.notice.action.href} className="btn btn-ghost !px-3 !py-1.5 !text-[12px]">
              {quickMatch.notice.action.label}
            </Link>
          )}
          {quickMatch.notice.retry && quickMatch.phase === "idle" && (
            <button
              type="button"
              onClick={() => void quickMatch.start()}
              className="btn btn-blue !px-3 !py-1.5 !text-[12px]"
            >
              <RotateCcw size={13} /> Search again
            </button>
          )}
          <button
            type="button"
            onClick={quickMatch.dismissNotice}
            aria-label="Dismiss"
            className="rounded-md p-1 opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-300">
          {error}
        </p>
      )}

      <MyInvitations onAccepted={(roomId) => router.push(`/rooms/${roomId}`)} />
    </AppLayout>
  );
}
