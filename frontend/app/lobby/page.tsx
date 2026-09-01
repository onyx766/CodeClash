"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LogIn,
  Lock,
  PlayCircle,
  Plus,
  RefreshCw,
  Users,
  Zap,
} from "lucide-react";
import { rooms as roomsApi } from "../../lib/api";
import AppLayout from "../../components/layout/AppLayout";
import DashboardSidebar from "../../components/app/DashboardSidebar";
import LobbyRail from "../../components/app/LobbyRail";
import { Avatar } from "../../components/ui/Bits";
import { activeRooms as demoRooms } from "../../lib/demo";

type ApiRoom = {
  id: string;
  code: string;
  maxPlayers?: number;
  players?: unknown[];
  host?: { username?: string } | null;
};

type RoomRow = {
  id?: string;
  code: string;
  host: string;
  avatar: string;
  players: number;
  max: number;
  level: string;
  req: string;
};

async function fetchRooms(): Promise<RoomRow[] | null> {
  try {
    const list: ApiRoom[] = await roomsApi.list();
    if (!Array.isArray(list) || !list.length) return null;
    return list.map((r, i) => ({
      id: r.id,
      code: r.code,
      host: r.host?.username ?? "Unknown",
      avatar: demoRooms[i % demoRooms.length].avatar,
      players: r.players?.length ?? 0,
      max: r.maxPlayers ?? 2,
      level: "All Levels",
      req: "Any Level",
    }));
  } catch {
    return null;
  }
}

const fallbackRooms: RoomRow[] = demoRooms.map((r) => ({
  code: r.code,
  host: r.host,
  avatar: r.avatar,
  players: r.players,
  max: r.max,
  level: r.level,
  req: r.req,
}));

export default function LobbyPage() {
  const router = useRouter();
  const [rows, setRows] = useState<RoomRow[]>(fallbackRooms);
  const [live, setLive] = useState(false);
  const [code, setCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRooms().then((next) => {
      if (!cancelled && next) {
        setRows(next);
        setLive(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => {
    setRefreshing(true);
    fetchRooms().then((next) => {
      if (next) {
        setRows(next);
        setLive(true);
      }
      setRefreshing(false);
    });
  };

  const create = async () => {
    setError("");
    try {
      const r = await roomsApi.create(2);
      router.push(`/rooms/${r.id}`);
    } catch {
      setError("Could not create a room. Is the backend running?");
    }
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
      onClick: create,
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

      <section className="card mt-5">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            Active Rooms
            <span className="text-[12px] font-semibold text-dim">{rows.length}</span>
            {live && (
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-emerald-400">
                live
              </span>
            )}
          </h2>
          <button type="button" onClick={refresh} className="link-quiet">
            View All Rooms
          </button>
        </header>

        <ul className="divide-y divide-line/70">
          {rows.map((r) => {
            const full = r.players >= r.max;
            return (
              <li
                key={r.code}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1.4fr)_80px_minmax(0,1fr)_auto]"
              >
                <Avatar src={r.avatar} alt={r.host} size={34} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
                    Room: {r.code}
                    <Lock size={11} className="text-amber" />
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-dim">Created by {r.host}</p>
                </div>
                <div className="col-start-2 sm:col-start-auto">
                  <p className="text-[13px] font-semibold">
                    {r.players} / {r.max}
                  </p>
                  <p className="mt-0.5 text-[11px] text-dim">Players</p>
                </div>
                <div className="col-start-2 sm:col-start-auto">
                  <p className="truncate text-[13px] font-semibold">{r.level}</p>
                  <p className="mt-0.5 truncate text-[11px] text-dim">{r.req}</p>
                </div>
                <button
                  type="button"
                  disabled={full}
                  onClick={() => join(r.code)}
                  className={`col-start-2 justify-self-start sm:col-start-auto sm:justify-self-end ${
                    full
                      ? "cursor-not-allowed rounded-lg bg-white/5 px-6 py-2 text-[12.5px] font-semibold text-dim"
                      : "btn btn-blue !px-7 !py-2 !text-[12.5px]"
                  }`}
                  aria-label={full ? `${r.code} is full` : `Join room ${r.code}`}
                >
                  {full ? "Full" : "Join"}
                </button>
              </li>
            );
          })}
          {!rows.length && (
            <li className="px-4 py-10 text-center text-[13px] text-dim">
              No active rooms right now — create one to get started.
            </li>
          )}
        </ul>

        <div className="px-4 py-4">
          <button
            type="button"
            onClick={refresh}
            className="btn btn-ghost mx-auto !py-2.5 !text-[12.5px]"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh Rooms
          </button>
        </div>
      </section>
    </AppLayout>
  );
}
