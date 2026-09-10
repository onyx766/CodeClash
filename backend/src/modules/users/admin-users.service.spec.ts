import { Test, TestingModule } from '@nestjs/testing';
import { Role, UserStatus } from '@prisma/client';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../../database/prisma.service';
import {
  CannotModerateSelfException,
  EmailAlreadyExistsException,
  InsufficientRankException,
  UserAlreadyInStateException,
  UserNotFoundException,
  UsernameAlreadyExistsException,
} from '../../common/exceptions/app.exception';
import type { AuthenticatedUser } from '../auth/auth.types';

const actor = (role: Role, id = 'actor-1'): AuthenticatedUser => ({
  id,
  username: 'actor',
  email: 'actor@example.com',
  role,
  createdAt: new Date(),
});

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'alexchen',
    email: 'alex@example.com',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2024-01-12T00:00:00.000Z'),
    lastActiveAt: new Date('2024-06-01T00:00:00.000Z'),
    bannedAt: null,
    banReason: null,
    country: 'US',
    stats: { rating: 1842, matchesPlayed: 30, wins: 18, losses: 12 },
    ...overrides,
  };
}

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AdminUsersService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list', () => {
    beforeEach(() => {
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([userRow()]);
    });

    it('never selects the password hash', async () => {
      await service.list({});
      const select = prisma.user.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('passwordHash');
    });

    it('flattens the rating out of the stats relation', async () => {
      const { users } = await service.list({});
      expect(users[0]).toMatchObject({
        username: 'alexchen',
        role: Role.USER,
        status: UserStatus.ACTIVE,
        rating: 1842,
      });
      expect(users[0]).not.toHaveProperty('stats');
    });

    it('reports rating as null for an account with no stats row', async () => {
      prisma.user.findMany.mockResolvedValue([userRow({ stats: null })]);
      const { users } = await service.list({});
      expect(users[0].rating).toBeNull();
    });

    it('searches username, email and exact id', async () => {
      await service.list({ search: '  alex ' });
      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { username: { contains: 'alex', mode: 'insensitive' } },
        { email: { contains: 'alex', mode: 'insensitive' } },
        { id: 'alex' },
      ]);
    });

    it('filters by role and status', async () => {
      await service.list({ role: Role.ADMIN, status: UserStatus.BANNED });
      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.role).toBe(Role.ADMIN);
      expect(where.status).toBe(UserStatus.BANNED);
    });

    it('turns a join window into a createdAt lower bound', async () => {
      await service.list({ joinedWithin: '7d' });
      const where = prisma.user.findMany.mock.calls[0][0].where;
      const cutoff = where.createdAt.gte as Date;
      const days = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(7, 1);
    });

    it('sorts never-signed-in accounts last when ordering by activity', async () => {
      await service.list({ sortBy: 'lastActiveAt', sortDir: 'desc' });
      expect(prisma.user.findMany.mock.calls[0][0].orderBy).toEqual({
        lastActiveAt: { sort: 'desc', nulls: 'last' },
      });
    });

    it('sorts by rating through the stats relation', async () => {
      await service.list({ sortBy: 'rating', sortDir: 'asc' });
      expect(prisma.user.findMany.mock.calls[0][0].orderBy).toEqual({
        stats: { rating: 'asc' },
      });
    });

    it('paginates and reports total pages', async () => {
      prisma.user.count.mockResolvedValue(45);
      const { pagination } = await service.list({ page: 3, pageSize: 20 });
      expect(prisma.user.findMany.mock.calls[0][0]).toMatchObject({
        skip: 40,
        take: 20,
      });
      expect(pagination).toEqual({
        page: 3,
        pageSize: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it('reports one page when there are no users at all', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);
      const { pagination } = await service.list({});
      expect(pagination.totalPages).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // stats
  // -------------------------------------------------------------------------

  describe('stats', () => {
    it('derives the cards from real counts', async () => {
      // total, active, banned, new30, previous30, banned30
      prisma.user.count
        .mockResolvedValueOnce(120)
        .mockResolvedValueOnce(110)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(4);

      const { stats } = await service.stats();

      expect(stats.total.value).toBe(120);
      expect(stats.active.value).toBe(110);
      expect(stats.banned.value).toBe(10);
      expect(stats.newUsers.value).toBe(20);
      // 20 new this window vs 10 in the previous one.
      expect(stats.newUsers.percentChange).toBe(100);
    });

    it('reports null rather than a fake percentage when the baseline is zero', async () => {
      prisma.user.count.mockResolvedValue(0);
      const { stats } = await service.stats();
      expect(stats.total.percentChange).toBeNull();
      expect(stats.newUsers.percentChange).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // moderation
  // -------------------------------------------------------------------------

  describe('ban', () => {
    it('bans a lower-ranked account and records who did it', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.USER,
        status: UserStatus.ACTIVE,
      });
      prisma.user.update.mockResolvedValue(
        userRow({ status: UserStatus.BANNED, bannedAt: new Date() }),
      );

      const result = await service.ban(actor(Role.ADMIN), 'user-1', {
        reason: 'Cheating',
      });

      expect(result.user.status).toBe(UserStatus.BANNED);
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
        status: UserStatus.BANNED,
        banReason: 'Cheating',
        bannedById: 'actor-1',
      });
    });

    it('refuses to ban your own account', async () => {
      await expect(
        service.ban(actor(Role.MASTER, 'me'), 'me', {}),
      ).rejects.toBeInstanceOf(CannotModerateSelfException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses an ADMIN banning another ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      });

      await expect(
        service.ban(actor(Role.ADMIN), 'user-1', {}),
      ).rejects.toBeInstanceOf(InsufficientRankException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses to ban a MASTER, even as another MASTER', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.MASTER,
        status: UserStatus.ACTIVE,
      });

      await expect(
        service.ban(actor(Role.MASTER), 'user-1', {}),
      ).rejects.toBeInstanceOf(InsufficientRankException);
    });

    it('lets a MASTER ban an ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      });
      prisma.user.update.mockResolvedValue(userRow({ status: UserStatus.BANNED }));

      await expect(
        service.ban(actor(Role.MASTER), 'user-1', {}),
      ).resolves.toBeDefined();
    });

    it('rejects an unknown account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.ban(actor(Role.ADMIN), 'nope', {}),
      ).rejects.toBeInstanceOf(UserNotFoundException);
    });

    it('rejects banning an already banned account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.USER,
        status: UserStatus.BANNED,
      });
      await expect(
        service.ban(actor(Role.ADMIN), 'user-1', {}),
      ).rejects.toBeInstanceOf(UserAlreadyInStateException);
    });
  });

  describe('unban', () => {
    it('clears the ban record', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.USER,
        status: UserStatus.BANNED,
      });
      prisma.user.update.mockResolvedValue(userRow());

      await service.unban(actor(Role.ADMIN), 'user-1');

      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        status: UserStatus.ACTIVE,
        bannedAt: null,
        banReason: null,
        bannedById: null,
      });
    });

    it('rejects unbanning an account that is not banned', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.USER,
        status: UserStatus.ACTIVE,
      });
      await expect(
        service.unban(actor(Role.ADMIN), 'user-1'),
      ).rejects.toBeInstanceOf(UserAlreadyInStateException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    const payload = {
      email: 'new@example.com',
      username: 'newbie',
      password: 'password123',
    };

    it('creates a USER with a hashed password and supporting rows', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(userRow());

      await service.create(actor(Role.ADMIN), payload);

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.role).toBe(Role.USER);
      expect(data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(data.passwordHash).not.toContain('password123');
      expect(data.profile).toEqual({ create: {} });
      expect(data.stats).toEqual({ create: {} });
    });

    it('refuses to let an ADMIN mint an ADMIN or MASTER', async () => {
      for (const role of [Role.ADMIN, Role.MASTER]) {
        await expect(
          service.create(actor(Role.ADMIN), { ...payload, role }),
        ).rejects.toBeInstanceOf(InsufficientRankException);
      }
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('lets a MASTER create an ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(userRow({ role: Role.ADMIN }));

      await service.create(actor(Role.MASTER), { ...payload, role: Role.ADMIN });

      expect(prisma.user.create.mock.calls[0][0].data.role).toBe(Role.ADMIN);
    });

    it('reports a duplicate email or username distinctly', async () => {
      prisma.user.findFirst.mockResolvedValue({
        email: payload.email,
        username: 'someone',
      });
      await expect(
        service.create(actor(Role.ADMIN), payload),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsException);

      prisma.user.findFirst.mockResolvedValue({
        email: 'other@example.com',
        username: payload.username,
      });
      await expect(
        service.create(actor(Role.ADMIN), payload),
      ).rejects.toBeInstanceOf(UsernameAlreadyExistsException);
    });
  });
});
