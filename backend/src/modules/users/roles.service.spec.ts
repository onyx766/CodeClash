import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { RolesService } from './roles.service';
import { PrismaService } from '../../database/prisma.service';
import {
  ForbiddenRoleChangeException,
  LastMasterRequiredException,
  UserNotFoundException,
} from '../../common/exceptions/app.exception';

type MockPrisma = {
  user: { findUnique: jest.Mock; count: jest.Mock; update: jest.Mock };
};

describe('RolesService', () => {
  let service: RolesService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(RolesService);
  });

  it('rejects a non-MASTER actor without touching the database', async () => {
    await expect(
      service.changeRole(Role.ADMIN, 'target-1', Role.ADMIN),
    ).rejects.toBeInstanceOf(ForbiddenRoleChangeException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws UserNotFoundException for an unknown target user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.changeRole(Role.MASTER, 'ghost', Role.ADMIN),
    ).rejects.toBeInstanceOf(UserNotFoundException);
  });

  it('lets a MASTER promote a USER to ADMIN', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target-1',
      role: Role.USER,
    });
    prisma.user.update.mockResolvedValue({
      id: 'target-1',
      username: 'alice',
      email: 'alice@example.com',
      role: Role.ADMIN,
      createdAt: new Date(),
    });

    const result = await service.changeRole(Role.MASTER, 'target-1', Role.ADMIN);

    expect(result.role).toBe(Role.ADMIN);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'target-1' },
      data: { role: Role.ADMIN },
      select: expect.any(Object),
    });
  });

  it('lets a MASTER demote an ADMIN to USER', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target-1',
      role: Role.ADMIN,
    });
    prisma.user.update.mockResolvedValue({
      id: 'target-1',
      username: 'alice',
      email: 'alice@example.com',
      role: Role.USER,
      createdAt: new Date(),
    });

    const result = await service.changeRole(Role.MASTER, 'target-1', Role.USER);
    expect(result.role).toBe(Role.USER);
  });

  it('blocks demoting the last remaining MASTER', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target-1',
      role: Role.MASTER,
    });
    prisma.user.count.mockResolvedValue(1);

    await expect(
      service.changeRole(Role.MASTER, 'target-1', Role.ADMIN),
    ).rejects.toBeInstanceOf(LastMasterRequiredException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows demoting a MASTER when other MASTER accounts still exist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target-1',
      role: Role.MASTER,
    });
    prisma.user.count.mockResolvedValue(2);
    prisma.user.update.mockResolvedValue({
      id: 'target-1',
      username: 'bob',
      email: 'bob@example.com',
      role: Role.ADMIN,
      createdAt: new Date(),
    });

    const result = await service.changeRole(Role.MASTER, 'target-1', Role.ADMIN);
    expect(result.role).toBe(Role.ADMIN);
  });

  it('does not require the last-MASTER check when the new role is still MASTER', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target-1',
      role: Role.MASTER,
    });
    prisma.user.update.mockResolvedValue({
      id: 'target-1',
      username: 'alice',
      email: 'alice@example.com',
      role: Role.MASTER,
      createdAt: new Date(),
    });

    await service.changeRole(Role.MASTER, 'target-1', Role.MASTER);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });
});
