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
  };
  const redis = { del: jest.fn(), set: jest.fn() };
  const gateway = new SocketGateway(
    {} as any,
    { get: jest.fn() } as any,
    { getClient: () => redis } as any,
    prisma as any,
  );
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  gateway.server = { to, emit } as any;
  return { gateway, prisma, redis, emit, to };
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
