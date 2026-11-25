import type { Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SocketGateway } from './socket.gateway';

type Account = {
  role: string;
  status: string;
  sessionsRevokedAt: Date | null;
};

const ACCOUNTS: Record<string, Account> = {
  ryan: { role: 'USER', status: 'ACTIVE', sessionsRevokedAt: null },
  banned: { role: 'USER', status: 'BANNED', sessionsRevokedAt: null },
  // Changed their password a minute ago.
  revoked: {
    role: 'USER',
    status: 'ACTIVE',
    sessionsRevokedAt: new Date(Date.now() - 60_000),
  },
};

const now = () => Math.floor(Date.now() / 1000);

/** What the client's connect_error carries: message and data.code. */
const refused = (code: string) => ({ message: code, data: { code } });

describe('SocketGateway handshake middleware', () => {
  type Next = (err?: Error) => void;

  afterEach(() => jest.restoreAllMocks());

  function build() {
    const verify = jest.fn();
    const findUnique = jest.fn((args: { where: { id: string } }) =>
      Promise.resolve(ACCOUNTS[args.where.id] ?? null),
    );
    const redis = { set: jest.fn(() => Promise.resolve('OK')) };
    const gateway = new SocketGateway(
      { verify } as unknown as JwtService,
      { get: () => undefined } as unknown as ConfigService,
      { getClient: () => redis } as unknown as RedisService,
      { user: { findUnique } } as unknown as PrismaService,
    );
    return { gateway, verify, findUnique, redis };
  }

  /** A handshaking socket, with handles on what the gateway touches. */
  function handshakeSocket(
    from: { auth?: object; headers?: object } = { auth: { token: 'tkn' } },
  ) {
    const data: { user?: unknown } = {};
    const join = jest.fn();
    const disconnect = jest.fn();
    const client = {
      id: 'socket-1',
      handshake: { auth: {}, headers: {}, ...from },
      data,
      join,
      disconnect,
    } as unknown as Socket;
    return { client, data, join, disconnect };
  }

  /** Runs one handshake through the middleware afterInit registers. */
  function handshake(gateway: SocketGateway, client: Socket) {
    const use = jest.fn();
    gateway.afterInit({ use } as unknown as Server);
    const [middleware] = use.mock.calls[0] as [(s: Socket, next: Next) => void];
    // Resolves with whatever the middleware passed to next().
    return new Promise<Error | undefined>((resolve) =>
      middleware(client, resolve),
    );
  }

  it('admits a valid access token and binds the identity held in the database', async () => {
    const { gateway, verify } = build();
    // The token claims ADMIN; the database says USER.
    verify.mockReturnValue({
      sub: 'ryan',
      role: 'ADMIN',
      type: 'access',
      iat: now(),
    });
    const { client, data } = handshakeSocket();

    await expect(handshake(gateway, client)).resolves.toBeUndefined();

    expect(data.user).toEqual({ id: 'ryan', role: 'USER' });
  });

  it.each([
    [
      'the access-token cookie',
      { headers: { cookie: 'theme=dark; cc_access_token=tkn' } },
    ],
    ['auth.token', { auth: { token: 'tkn' } }],
    [
      'a Bearer Authorization header',
      { headers: { authorization: 'Bearer tkn' } },
    ],
  ])('reads the token from %s', async (_source, from) => {
    const { gateway, verify } = build();
    verify.mockReturnValue({ sub: 'ryan', type: 'access', iat: now() });

    const { client } = handshakeSocket(from);
    await expect(handshake(gateway, client)).resolves.toBeUndefined();

    expect((verify.mock.calls[0] as unknown[])[0]).toBe('tkn');
  });

  it('refuses a handshake without a token as UNAUTHENTICATED', async () => {
    const { gateway, verify } = build();
    const { client, data } = handshakeSocket({});

    const error = await handshake(gateway, client);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject(refused('UNAUTHENTICATED'));
    expect(verify).not.toHaveBeenCalled();
    expect(data.user).toBeUndefined();
  });

  it('refuses a bad or expired token, a refresh token and an unknown account as UNAUTHENTICATED', async () => {
    const { gateway, verify } = build();
    verify
      .mockImplementationOnce(() => {
        throw new Error('jwt expired');
      })
      .mockReturnValueOnce({ sub: 'ryan', type: 'refresh', iat: now() })
      .mockReturnValueOnce({ sub: 'nobody', type: 'access', iat: now() });

    for (let attempt = 0; attempt < 3; attempt++) {
      const { client } = handshakeSocket();
      await expect(handshake(gateway, client)).resolves.toMatchObject(
        refused('UNAUTHENTICATED'),
      );
    }
  });

  it('refuses a banned account as ACCOUNT_BANNED', async () => {
    const { gateway, verify } = build();
    verify.mockReturnValue({ sub: 'banned', type: 'access', iat: now() });
    const { client, data } = handshakeSocket();

    await expect(handshake(gateway, client)).resolves.toMatchObject(
      refused('ACCOUNT_BANNED'),
    );
    expect(data.user).toBeUndefined();
  });

  it('refuses a token issued before the sessions were revoked as SESSION_REVOKED', async () => {
    const { gateway, verify } = build();
    verify.mockReturnValue({
      sub: 'revoked',
      type: 'access',
      iat: now() - 3600,
    });
    const { client } = handshakeSocket();

    await expect(handshake(gateway, client)).resolves.toMatchObject(
      refused('SESSION_REVOKED'),
    );
  });

  it('refuses as UNAUTHENTICATED when the account cannot be checked, so the client retries', async () => {
    const { gateway, verify, findUnique } = build();
    verify.mockReturnValue({ sub: 'ryan', type: 'access', iat: now() });
    findUnique.mockRejectedValueOnce(new Error('database unreachable'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { client } = handshakeSocket();

    await expect(handshake(gateway, client)).resolves.toMatchObject(
      refused('UNAUTHENTICATED'),
    );
  });

  it('records presence and the matchmaking heartbeat, and admits the socket even when Redis fails', async () => {
    const { gateway, verify, redis } = build();
    verify.mockReturnValue({ sub: 'ryan', type: 'access', iat: now() });

    const first = handshakeSocket();
    await expect(handshake(gateway, first.client)).resolves.toBeUndefined();
    await new Promise((resolve) => setImmediate(resolve));
    expect(redis.set.mock.calls).toEqual([
      ['player:ryan:presence', 'socket-1', 'EX', 3600],
      ['matchmaking:quick:lastseen:ryan', '1', 'PX', 10_000],
    ]);

    redis.set.mockRejectedValue(new Error('redis down'));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const second = handshakeSocket();
    await expect(handshake(gateway, second.client)).resolves.toBeUndefined();
  });

  it('joins the user channel synchronously as an admitted socket connects', () => {
    const { gateway } = build();
    const { client, data, join } = handshakeSocket();
    data.user = { id: 'ryan', role: 'USER' };

    expect(gateway.handleConnection(client)).toBeUndefined();

    expect(join).toHaveBeenCalledWith('user:ryan');
  });

  it('disconnects a socket that reached the connection without an identity', () => {
    const { gateway } = build();
    const { client, join, disconnect } = handshakeSocket();

    gateway.handleConnection(client);

    expect(disconnect).toHaveBeenCalledWith(true);
    expect(join).not.toHaveBeenCalled();
  });
});

describe('SocketGateway over a real Socket.IO server', () => {
  const SECRET = 'socket-handshake-spec-secret';
  const jwt = new JwtService({ secret: SECRET });
  const accessToken = (sub: string, iat = now()) =>
    jwt.sign({ sub, role: 'USER', type: 'access', iat });

  const prisma = {
    user: {
      // Slow on purpose: a socket bound after 'connect' would still be
      // unbound when the client's first event arrives.
      findUnique: jest.fn(
        (args: { where: { id: string } }) =>
          new Promise((resolve) =>
            setTimeout(() => resolve(ACCOUNTS[args.where.id] ?? null), 50),
          ),
      ),
    },
    matchParticipant: {
      findUnique: jest.fn(
        (args: { where: { matchId_userId: { userId: string } } }) =>
          Promise.resolve(
            args.where.matchId_userId.userId === 'ryan'
              ? { id: 'p-ryan' }
              : null,
          ),
      ),
    },
  };
  const redis = {
    set: jest.fn(() => Promise.resolve('OK')),
    del: jest.fn(() => Promise.resolve(1)),
  };

  let app: INestApplication<HttpServer>;
  let gateway: SocketGateway;
  let url: string;
  const opened: WebSocket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SocketGateway,
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'JWT_ACCESS_SECRET' ? SECRET : undefined,
          },
        },
        { provide: RedisService, useValue: { getClient: () => redis } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<HttpServer>>({
      logger: false,
    });
    await app.listen(0, '127.0.0.1');
    gateway = app.get(SocketGateway);
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`;
  });

  afterEach(() => {
    for (const ws of opened.splice(0)) ws.close();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * A bare Socket.IO v4 client on the default namespace, the way
   * scripts/smoke-test.mjs talks to the server: answers the engine.io open
   * with a CONNECT carrying `auth`, and hands back every later packet.
   */
  function connect(auth: object) {
    const ws = new WebSocket(url);
    opened.push(ws);
    const packets: string[] = [];
    let wake: (() => void) | null = null;
    ws.onmessage = (event: MessageEvent) => {
      const packet = String(event.data);
      if (packet.startsWith('0')) ws.send(`40${JSON.stringify(auth)}`);
      else if (packet === '2') ws.send('3');
      else {
        packets.push(packet);
        wake?.();
      }
    };
    const next = async (): Promise<string> => {
      const deadline = Date.now() + 5_000;
      while (packets.length === 0) {
        if (Date.now() > deadline) throw new Error('no packet from the server');
        await new Promise<void>((resolve) => {
          wake = resolve;
          setTimeout(resolve, 100);
        });
      }
      return packets.shift()!;
    };
    return { ws, next };
  }

  it.each([
    ['no token', {}, 'UNAUTHENTICATED'],
    ['a malformed token', { token: 'not-a-jwt' }, 'UNAUTHENTICATED'],
    ['a banned account', { token: accessToken('banned') }, 'ACCOUNT_BANNED'],
    [
      'a token issued before a password change',
      { token: accessToken('revoked', now() - 3600) },
      'SESSION_REVOKED',
    ],
  ])(
    'answers a handshake with %s with connect_error %s',
    async (_case, auth, code) => {
      const client = connect(auth);

      expect(await client.next()).toBe(`44${JSON.stringify(refused(code))}`);
    },
  );

  it('has bound the user and joined its channel by the time the client sees connect', async () => {
    const client = connect({ token: accessToken('ryan') });

    expect(await client.next()).toMatch(/^40\{"sid":"/);
    // Sent from the connect handler, as the player app does.
    client.ws.send('421["match:join",{"matchId":"match-1"}]');
    expect(await client.next()).toBe('431[{"ok":true}]');

    gateway.emitToUser('ryan', 'matchmaking:searching', { n: 1 });
    expect(await client.next()).toBe('42["matchmaking:searching",{"n":1}]');
  });
});
