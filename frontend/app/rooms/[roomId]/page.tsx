'use client'
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket } from '../../../lib/socket';
import { rooms, matches, ApiError } from '../../../lib/api';
import useAuth from '../../../hooks/useAuth';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [room, setRoom] = useState<any>(null);
  const [readyMap, setReadyMap] = useState<Record<string,string>>({});
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
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

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage('');
    try {
      await rooms.invite(roomId, inviteUsername.trim());
      setInviteMessage(`Invite sent to ${inviteUsername.trim()}.`);
      setInviteUsername('');
    } catch (err) {
      setInviteMessage(err instanceof ApiError ? err.message : 'Could not send invite.');
    }
  };

  const isHost = user?.id && room?.hostId === user.id;

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
      {isHost && (
        <div className="mt-6">
          <h3>Invite a Friend</h3>
          <form onSubmit={invite} className="flex gap-2 mt-2">
            <input
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="Friend's username"
              className="field"
            />
            <button type="submit" className="btn" disabled={!inviteUsername.trim()}>
              Send Invite
            </button>
          </form>
          {inviteMessage && <p className="mt-2 text-sm">{inviteMessage}</p>}
        </div>
      )}
    </div>
  );
}
