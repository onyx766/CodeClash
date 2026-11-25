import type { Socket } from 'socket.io';
import { SocketGateway } from './socket.gateway';

const USERS: Record<string, { role: string; status: string }> = {
  ryan: { role: 'USER', status: 'ACTIVE' },
  master1: { role: 'USER', status: 'ACTIVE' },
  stranger: { role: 'USER', status: 'ACTIVE' },
  admin: { role: 'ADMIN', status: 'ACTIVE' },
  bannedAdmin: { role: 'ADMIN', status: 'BANNED' },
};
const PARTICIPANTS = new Set(['ryan', 'master1']);
const ROOM_PLAYERS = new Set(['ryan', 'master1']);

function build() {
  const prisma = {
    matchParticipant: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.matchId_userId.matchId === 'match-1' && PARTICIPANTS.has(where.matchId_userId.userId)
          ? { id: `p-${where.matchId_userId.userId}` }
          : null,
      ),
    },
    user: { findUnique: jest.fn(async ({ where }: any) => USERS[where.id] ?? null) },
    match: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    roomPlayer: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.roomId === 'room-1' && ROOM_PLAYERS.has(where.userId) ? { id: `rp-${where.userId}` } : null,
      ),
    },
    room: { findUnique: jest.fn(async () => ({ id: 'room-1', players: [] })) },
  };
  const redis = {
    del: jest.fn(),
    set: jest.fn(),
    hset: jest.fn(),
    expire: jest.fn(),
    hgetall: jest.fn(async () => ({})),
  };
  const jwt = { verify: jest.fn() };
  const gateway = new SocketGateway(
    jwt as any,
    { get: jest.fn() } as any,
    { getClient: () => redis } as any,
    prisma as any,
  );
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  gateway.server = { to, emit } as any;
  return { gateway, prisma, redis, emit, to, jwt };
}

function socketFor(userId?: string, role = 'USER') {
  return {
    data: userId ? { user: { id: userId, role } } : {},
    join: jest.fn(),
    leave: jest.fn(),
  } as unknown as Socket & { join: jest.Mock; leave: jest.Mock };
}

describe('SocketGateway match channel', () => {
  it('lets a participant join the match channel', async () => {
    const { gateway } = build();
    const client = socketFor('ryan');

    await expect(gateway.onMatchJoin(client, { matchId: 'match-1' })).resolves.toEqual({ ok: true });
    expect(client.join).toHaveBeenCalledWith('match:match-1');
  });

  it('refuses a user who is not in the match', async () => {
    const { gateway } = build();
    const client = socketFor('stranger');

    await expect(gateway.onMatchJoin(client, { matchId: 'match-1' })).resolves.toEqual({
      ok: false,
      error: 'MATCH_ACCESS_DENIED',
    });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('uses the authenticated socket identity, never a userId in the payload', async () => {
    const { gateway, prisma } = build();
    const client = socketFor('stranger');

    const result = await gateway.onMatchJoin(client, { matchId: 'match-1', userId: 'ryan' } as any);

    expect(result.ok).toBe(false);
    expect(prisma.matchParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { matchId_userId: { matchId: 'match-1', userId: 'stranger' } } }),
    );
    expect(client.join).not.toHaveBeenCalled();
  });

  it('lets an active ADMIN spectate, judged by the database role not the token', async () => {
    const { gateway } = build();

    await expect(gateway.onMatchJoin(socketFor('admin'), { matchId: 'match-1' })).resolves.toEqual({ ok: true });
    await expect(
      gateway.onMatchJoin(socketFor('bannedAdmin', 'ADMIN'), { matchId: 'match-1' }),
    ).resolves.toMatchObject({ ok: false });
    // A token claiming ADMIN does not help a USER.
    await expect(
      gateway.onMatchJoin(socketFor('stranger', 'ADMIN'), { matchId: 'match-1' }),
    ).resolves.toMatchObject({ ok: false });
  });

  it('refuses unauthenticated sockets and malformed payloads', async () => {
    const { gateway } = build();
    await expect(gateway.onMatchJoin(socketFor(), { matchId: 'match-1' })).resolves.toMatchObject({ ok: false });
    await expect(gateway.onMatchJoin(socketFor('ryan'), {} as any)).resolves.toEqual({
      ok: false,
      error: 'INVALID_REQUEST',
    });
  });

  it('broadcasts match events only to the match channel', () => {
    const { gateway, to, emit } = build();
    gateway.emitToMatch('match-1', 'match:progress', { matchId: 'match-1' });
    expect(to).toHaveBeenCalledWith('match:match-1');
    expect(emit).toHaveBeenCalledWith('match:progress', { matchId: 'match-1' });
  });

  it('does not touch any match when a socket disconnects', async () => {
    const { gateway, prisma, redis } = build();

    await gateway.handleDisconnect(socketFor('ryan'));

    expect(redis.del).toHaveBeenCalledWith('player:ryan:presence');
    expect(prisma.match.update).not.toHaveBeenCalled();
    expect(prisma.match.updateMany).not.toHaveBeenCalled();
    expect(prisma.match.findUnique).not.toHaveBeenCalled();
  });
});

describe('SocketGateway room channel', () => {
  it('lets a room player subscribe and broadcasts a snapshot without private user fields', async () => {
    const { gateway, prisma, to } = build();
    const client = socketFor('ryan');

    await expect(gateway.onRoomJoin(client, { roomId: 'room-1' })).resolves.toEqual({ ok: true });

    expect(client.join).toHaveBeenCalledWith('room:room-1');
    expect(to).toHaveBeenCalledWith('room:room-1');
    const include = prisma.room.findUnique.mock.calls[0][0].include;
    expect(include.players.include.user).toEqual({ select: { id: true, username: true } });
  });

  it('refuses a user who is not in the room', async () => {
    const { gateway, emit } = build();
    const client = socketFor('stranger');

    await expect(gateway.onRoomJoin(client, { roomId: 'room-1' })).resolves.toEqual({
      ok: false,
      error: 'ROOM_ACCESS_DENIED',
    });
    expect(client.join).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('only lets room players set a ready flag, and expires the flags', async () => {
    const { gateway, redis } = build();

    await expect(gateway.onRoomReady(socketFor('stranger'), { roomId: 'room-1', ready: true })).resolves.toMatchObject({
      ok: false,
    });
    expect(redis.hset).not.toHaveBeenCalled();

    await expect(gateway.onRoomReady(socketFor('ryan'), { roomId: 'room-1', ready: true })).resolves.toEqual({ ok: true });
    expect(redis.hset).toHaveBeenCalledWith('room:room-1:ready', 'ryan', '1');
    expect(redis.expire).toHaveBeenCalledWith('room:room-1:ready', expect.any(Number));
  });

  it('rejects malformed room ids', async () => {
    const { gateway } = build();
    await expect(gateway.onRoomJoin(socketFor('ryan'), { roomId: 42 } as any)).resolves.toEqual({
      ok: false,
      error: 'INVALID_REQUEST',
    });
  });
});

describe('SocketGateway handshake', () => {
  const handshakeSocket = () =>
    ({
      handshake: { auth: { token: 'tkn' }, headers: {} },
      data: {} as any,
      join: jest.fn(),
      disconnect: jest.fn(),
    }) as unknown as Socket & { disconnect: jest.Mock; join: jest.Mock; data: any };

  it('refuses a banned account', async () => {
    const { gateway, jwt, prisma } = build();
    jwt.verify.mockReturnValue({ sub: 'u1', type: 'access', iat: 2_000_000_000 });
    prisma.user.findUnique.mockResolvedValueOnce({ status: 'BANNED', sessionsRevokedAt: null } as any);
    const client = handshakeSocket();

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.data.user).toBeUndefined();
  });

  it('refuses a token issued before the sessions were revoked', async () => {
    const { gateway, jwt, prisma } = build();
    jwt.verify.mockReturnValue({ sub: 'u1', type: 'access', iat: 1_000 });
    prisma.user.findUnique.mockResolvedValueOnce({
      status: 'ACTIVE',
      sessionsRevokedAt: new Date(2_000_000 * 1000),
    } as any);
    const client = handshakeSocket();

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
  });
});
