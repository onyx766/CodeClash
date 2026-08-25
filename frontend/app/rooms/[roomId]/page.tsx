'use client'
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket } from '../../../lib/socket';
import { rooms, matches } from '../../../lib/api';
import useAuth from '../../../hooks/useAuth';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [room, setRoom] = useState<any>(null);
  const [readyMap, setReadyMap] = useState<Record<string,string>>({});
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    rooms.get(roomId).then(setRoom).catch(() => {});
    const s = getSocket();
    s.emit('room:join', { roomId });
    s.on('room:update', (payload: any) => {
      if (payload.room) setRoom(payload.room);
      if (payload.ready) setReadyMap(payload.ready);
    });
    return () => {
      s.emit('room:leave', { roomId });
      s.off('room:update');
    };
  }, [roomId]);

  const toggleReady = () => {
    const s = getSocket();
    const amReady = readyMap[user?.id] === '1';
    s.emit('room:ready', { roomId, ready: !amReady });
  };

  const start = async () => {
    try {
      await matches.start(roomId);
    } catch (err) {
      alert('Start failed');
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl mb-4">Room {room?.code}</h2>
      <div className="mb-4">Host: {room?.hostId}</div>
      <div className="mb-4">
        <button onClick={toggleReady} className="btn">Toggle Ready</button>
        <button onClick={() => router.push('/lobby')} className="btn">Leave</button>
        <button onClick={start} className="btn">Start Match</button>
      </div>
      <div>
        <h3>Players</h3>
        <ul>
          {room?.players?.map((p: any) => (
            <li key={p.id}>{p.user?.username} {readyMap[p.userId] === '1' ? '(Ready)' : '(Not Ready)'}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
