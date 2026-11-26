"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Mail, RefreshCw, X } from "lucide-react";
import { ApiError, invitations as invitationsApi } from "../../lib/api";
import { onEveryConnect } from "../../lib/socket";
import useSocket from "../../hooks/useSocket";

type ApiInvitation = {
  id: string;
  createdAt: string;
  inviter: { id: string; username: string };
  room: { id: string; code: string; maxPlayers: number; _count?: { players: number } };
};

export default function MyInvitations({
  onAccepted,
}: {
  onAccepted: (roomId: string) => void;
}) {
  const [invites, setInvites] = useState<ApiInvitation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    return invitationsApi
      .mine()
      .then((list) => {
        if (Array.isArray(list)) setInvites(list);
      })
      .catch(() => {
        // backend unreachable - leave the current list as-is
      });
  }, []);

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, [load]);

  // New invitations arrive live; anything sent while the socket was down is
  // picked up by re-reading the list on reconnect.
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const onReceived = (payload?: { invitation?: ApiInvitation }) => {
      const invitation = payload?.invitation;
      if (!invitation?.id) return;
      setInvites((prev) => (prev.some((i) => i.id === invitation.id) ? prev : [invitation, ...prev]));
    };
    const stopConnect = onEveryConnect(socket, (reconnected) => {
      if (reconnected) void load();
    });
    socket.on("invitation:received", onReceived);
    return () => {
      stopConnect();
      socket.off("invitation:received", onReceived);
    };
  }, [socket, load]);

  const refresh = () => {
    setRefreshing(true);
    load().then(() => setRefreshing(false));
  };

  const respond = async (id: string, action: "accept" | "decline") => {
    setError("");
    setBusyId(id);
    try {
      if (action === "accept") {
        const res = await invitationsApi.accept(id);
        setInvites((prev) => prev.filter((i) => i.id !== id));
        onAccepted(res.room.id);
      } else {
        await invitationsApi.decline(id);
        setInvites((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the invitation.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card mt-5">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          My Invitations
          <span className="text-[12px] font-semibold text-dim">{invites.length}</span>
        </h2>
        <button type="button" onClick={refresh} className="link-quiet">
          Refresh
        </button>
      </header>

      {error && (
        <p className="mx-4 mt-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-300">
          {error}
        </p>
      )}

      <ul className="max-h-[360px] divide-y divide-line/70 overflow-y-auto">
        {invites.map((inv) => {
          const players = inv.room._count?.players ?? 0;
          const full = players >= inv.room.maxPlayers;
          const busy = busyId === inv.id;
          return (
            <li
              key={inv.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1.4fr)_80px_auto]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet/15 text-violet-300">
                <Mail size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">
                  {inv.inviter.username} invited you
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-dim">Room: {inv.room.code}</p>
              </div>
              <div className="col-start-2 sm:col-start-auto">
                <p className="text-[13px] font-semibold">
                  {players} / {inv.room.maxPlayers}
                </p>
                <p className="mt-0.5 text-[11px] text-dim">Players</p>
              </div>
              <div className="col-start-2 flex gap-2 sm:col-start-auto sm:justify-self-end">
                <button
                  type="button"
                  disabled={busy || full}
                  onClick={() => respond(inv.id, "accept")}
                  className="btn btn-blue !px-4 !py-2 !text-[12.5px]"
                  aria-label={`Accept invite from ${inv.inviter.username}`}
                >
                  <Check size={14} /> {full ? "Full" : "Accept"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(inv.id, "decline")}
                  className="btn btn-ghost !px-4 !py-2 !text-[12.5px]"
                  aria-label={`Decline invite from ${inv.inviter.username}`}
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          );
        })}
        {loaded && !invites.length && (
          <li className="px-4 py-10 text-center text-[13px] text-dim">
            No pending invitations — ask a friend to invite you to their room.
          </li>
        )}
      </ul>

      <div className="px-4 py-4">
        <button
          type="button"
          onClick={refresh}
          className="btn btn-ghost mx-auto !py-2.5 !text-[12.5px]"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh Invitations
        </button>
      </div>
    </section>
  );
}
