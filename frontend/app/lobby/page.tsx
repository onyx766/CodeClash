"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, PlayCircle, Plus, Users, Zap } from "lucide-react";
import { ApiError, rooms as roomsApi } from "../../lib/api";
import AppLayout from "../../components/layout/AppLayout";
import DashboardSidebar from "../../components/app/DashboardSidebar";
import LobbyRail from "../../components/app/LobbyRail";
import CreateRoomModal, { type CreateRoomOptions } from "../../components/app/CreateRoomModal";
import MyInvitations from "../../components/app/MyInvitations";

export default function LobbyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setError("");
    try {
      const r = await roomsApi.create(2);
      router.push(`/rooms/${r.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not create a room. Is the backend running?",
      );
    }
  };

  const createWithOptions = async ({ maxPlayers }: CreateRoomOptions) => {
    const r = await roomsApi.create(maxPlayers);
    setCreateOpen(false);
    router.push(`/rooms/${r.id}`);
  };

  const join = async (roomCode: string) => {
    setError("");
    if (!roomCode) {
      setJoinOpen(true);
      return;
    }
    try {
      const res = await roomsApi.join(roomCode);
      router.push(`/rooms/${res.room.id}`);
    } catch {
      setError(`Could not join room ${roomCode}.`);
    }
  };

  const cards = [
    {
      key: "quick",
      icon: Zap,
      title: "Quick Match",
      desc: "Find an opponent of similar skill and start a battle instantly.",
      cta: "Find Match",
      btn: "btn-blue",
      onClick: create,
      ring: "from-[#101a3a] to-[#0b1020] border-blue/30",
      badge: "from-blue to-blue-deep",
      foot: (
        <>
          <span className="dot-live" /> 1,248 players online
        </>
      ),
    },
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
      onClick: () => setJoinOpen((v) => !v),
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
    <AppLayout sidebar={<DashboardSidebar />} rail={<LobbyRail />}>
      <CreateRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createWithOptions}
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter room code (e.g. AB12CD)"
            aria-label="Room code"
            className="field"
          />
          <button type="submit" className="btn btn-blue sm:w-40">
            Join
          </button>
        </form>
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
