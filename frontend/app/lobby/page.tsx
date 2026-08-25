'use client'
import { useEffect, useState } from 'react';
import { rooms } from '../../lib/api';
import { useRouter } from 'next/navigation';
import useAuth from '../../hooks/useAuth';

export default function LobbyPage() {
  const [roomList, setRoomList] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    rooms.list().then((r) => setRoomList(r)).catch(() => setRoomList([]));
  }, []);

  const create = async () => {
    const r = await rooms.create(2);
    router.push(`/rooms/${r.id}`);
  };

  const join = async () => {
    try {
      const res = await rooms.join(code);
      router.push(`/rooms/${res.room.id}`);
    } catch (err) {
      alert('Join failed');
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl mb-4">Lobby</h2>
      <div className="mb-4">Welcome {user?.username || 'guest'}</div>
      <div className="mb-4">
        <button onClick={create} className="btn">Create Room</button>
      </div>
      <div className="mb-4">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter room code" />
        <button onClick={join} className="btn">Join</button>
      </div>
      <div>
        <h3 className="text-lg">Active Rooms</h3>
        <ul>
          {roomList.map((r: any) => (
            <li key={r.id} className="py-2">
              <a href={`/rooms/${r.id}`}>{r.code} — {r.players?.length || 0}/{r.maxPlayers}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
