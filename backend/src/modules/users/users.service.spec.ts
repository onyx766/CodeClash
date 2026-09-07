import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { UserNotFoundException } from '../../common/exceptions/app.exception';

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findById', () => {
    it('throws UserNotFoundException when no user matches', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(
        UserNotFoundException,
      );
    });

    it('never selects passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'kevin',
        email: 'kevin@example.com',
        role: Role.USER,
        createdAt: new Date(),
      });

      await service.findById('user-1');

      const select = prisma.user.findUnique.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('passwordHash');
    });
  });

  describe('create', () => {
    it('always creates the account with role USER, ignoring any caller intent', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-1' });

      await service.create({
        email: 'hacker@example.com',
        username: 'hacker',
        passwordHash: 'hashed',
        // @ts-expect-error role is intentionally not part of the accepted input
        role: Role.MASTER,
      });

      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.role).toBe(Role.USER);
    });

    it('creates the profile, stats, and preferences rows alongside the user', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-1' });

      await service.create({
        email: 'kevin@example.com',
        username: 'kevin',
        passwordHash: 'hashed',
      });

      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.profile).toEqual({ create: {} });
      expect(createArg.data.stats).toEqual({ create: {} });
      expect(createArg.data.preferences).toEqual({ create: {} });
    });
  });

  describe('updateLocation', () => {
    it('writes only the derived location fields for the given user', async () => {
      prisma.user.update.mockResolvedValue({});

      await service.updateLocation('user-1', {
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          country: 'United States',
          region: 'California',
          city: 'San Francisco',
          timezone: 'America/Los_Angeles',
        },
      });
    });
  });
});
