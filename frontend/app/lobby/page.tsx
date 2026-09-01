'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Lock,
  Play,
  Plus,
  RefreshCw,
  UserPlus,
  Zap,
} from 'lucide-react';
import { rooms } from '../../lib/api';
import useAuth from '../../hooks/useAuth';
import DashboardShell from '../../components/dashboard/DashboardShell';
import LobbyRightSidebar, { RefreshRoomsButton } from '../../components/dashboard/LobbyRightSidebar';

const mockRooms = [
  { code: 'AB12CD', creator: 'Jason', players: 1, max: 2, difficulty: 'All Levels', locked: true, color: '#3b82f6' },
  { code: 'XY98ZW', creator: 'Sarah', players: 1, max: 2, difficulty: 'Senior+', locked: false, color: '#8b5cf6' },
  { code: 'PQ56RS', creator: 'Mike', players: 2, max: 2, difficulty: 'All Levels', locked: true, color: '#10b981' },
  { code: 'LM34NO', creator: 'Emma', players: 1, max: 2, difficulty: 'Intermediate', locked: false, color: '#f59e0b' },
];

export default function LobbyPage() {
  const [roomList, setRoomList] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    rooms.list().then((r) => setRoomList(r)).catch(() => setRoomList([]));
  }, []);

  const refresh = () => {
    rooms.list().then((r) => setRoomList(r)).catch(() => setRoomList([]));
  };

  const create = async () => {
    const r = await rooms.create(2);
    router.push(`/rooms/${r.id}`);
  };

  const join = async (roomCode?: string) => {
    const target = roomCode || code;
    if (!target) return;
    try {
      const res = await rooms.join(target);
      router.push(`/rooms/${res.room.id}`);
    } catch {
      alert('Join failed');
    }
  };

  const displayRooms = roomList.length > 0
    ? roomList.map((r: any, i: number) => ({
        code: r.code,
        creator: r.players?.[0]?.username || mockRooms[i % mockRooms.length].creator,
        players: r.players?.length || 0,
        max: r.maxPlayers || 2,
        difficulty: mockRooms[i % mockRooms.length].difficulty,
        locked: mockRooms[i % mockRooms.length].locked,
        color: mockRooms[i % mockRooms.length].color,
        id: r.id,
      }))
    : mockRooms;

  return (
    <DashboardShell rightSidebar={<LobbyRightSidebar />}>
      <div className="dash-page-header">
        <div>
          <h1>Lobby 👋</h1>
          <p>Challenge developers, improve your skills, climb the leaderboard.</p>
        </div>
        <button type="button" className="btn-ghost-sm">
          <Play size={14} strokeWidth={2.2} />
          How Lobby Works
        </button>
      </div>

      <div className="action-cards">
        <article className="action-card action-card--blue">
          <div className="action-card-icon">
            <Zap size={24} strokeWidth={2} />
          </div>
          <h3>Quick Match</h3>
          <p>Find an opponent of similar skill and start a battle instantly.</p>
          <button type="button" className="btn-blue">
            <Zap size={16} /> Find Match
          </button>
          <span className="action-card-meta">🟢 1,248 players online</span>
        </article>

        <article className="action-card action-card--purple">
          <div className="action-card-icon">
            <UserPlus size={24} strokeWidth={2} />
          </div>
          <h3>Create Room</h3>
          <p>Create a private room and invite your friends.</p>
          <button type="button" className="btn-purple" onClick={create}>
            <Plus size={16} /> Create Room
          </button>
          <span className="action-card-meta">👥 Invite your friends</span>
        </article>

        <article className="action-card action-card--green">
          <div className="action-card-icon">
            <ArrowRight size={24} strokeWidth={2} />
          </div>
          <h3>Join Room</h3>
          <p>Enter a room code to join your friend&apos;s battle.</p>
          <div className="join-room-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Room code"
              className="join-input"
            />
            <button type="button" className="btn-green-outline" onClick={() => join()}>
              <ArrowRight size={16} /> Join Room
            </button>
          </div>
          <span className="action-card-meta">↪ Have a room code?</span>
        </article>
      </div>

      <section className="rooms-section">
        <div className="rooms-header">
          <h2>Active Rooms ({displayRooms.length})</h2>
          <a href="#" className="dash-link">View All Rooms</a>
        </div>

        <div className="rooms-table-wrap">
          <table className="rooms-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Code</th>
                <th>Creator</th>
                <th>Players</th>
                <th>Difficulty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayRooms.map((room: any) => (
                <tr key={room.code}>
                  <td>
                    <span className="room-avatar" style={{ background: room.color }}>
                      {room.creator[0]}
                    </span>
                  </td>
                  <td>
                    <span className="room-code">
                      {room.code} {room.locked && <Lock size={12} />}
                    </span>
                  </td>
                  <td>{room.creator}</td>
                  <td>{room.players}/{room.max} Players</td>
                  <td><span className="difficulty-badge">{room.difficulty}</span></td>
                  <td>
                    <button
                      type="button"
                      className="btn-blue-sm"
                      onClick={() => room.id ? router.push(`/rooms/${room.id}`) : join(room.code)}
                      disabled={room.players >= room.max}
                    >
                      Join
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RefreshRoomsButton onClick={refresh} />
      </section>

      {user && (
        <p className="welcome-text">Welcome back, {user.username}!</p>
      )}
    </DashboardShell>
  );
}
