import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { AdminUsersController } from './admin-users.controller';
import { RolesService } from './roles.service';
import { AdminUsersService } from './admin-users.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../auth/auth.types';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let rolesService: jest.Mocked<Pick<RolesService, 'changeRole'>>;

  const masterUser: AuthenticatedUser = {
    id: 'master-1',
    username: 'root',
    email: 'root@example.com',
    role: Role.MASTER,
    createdAt: new Date(),
  };

  let adminUsers: jest.Mocked<
    Pick<AdminUsersService, 'list' | 'stats' | 'ban' | 'unban' | 'create' | 'getById'>
  >;

  beforeEach(async () => {
    rolesService = { changeRole: jest.fn() };
    adminUsers = {
      list: jest.fn(),
      stats: jest.fn(),
      ban: jest.fn(),
      unban: jest.fn(),
      create: jest.fn(),
      getById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        { provide: RolesService, useValue: rolesService },
        { provide: AdminUsersService, useValue: adminUsers },
      ],
    }).compile();

    controller = module.get(AdminUsersController);
  });

  it('delegates to RolesService with the actor role, target id, and new role', async () => {
    rolesService.changeRole.mockResolvedValue({
      id: 'target-1',
      username: 'alice',
      email: 'alice@example.com',
      role: Role.ADMIN,
      createdAt: new Date(),
    });
    const req = { user: masterUser } as never;

    const result = await controller.updateRole('target-1', { role: Role.ADMIN }, req);

    expect(rolesService.changeRole).toHaveBeenCalledWith(
      Role.MASTER,
      'target-1',
      Role.ADMIN,
    );
    expect(result).toEqual({
      success: true,
      user: expect.objectContaining({ role: Role.ADMIN }),
    });
  });

  it('is guarded by JwtAuthGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminUsersController);
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('requires the MASTER role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.updateRole);
    expect(roles).toEqual([Role.MASTER]);
  });

  it('keeps role changes MASTER-only while reads and bans need ADMIN', () => {
    // Reading and moderating are ADMIN-level; handing out roles stays MASTER.
    for (const handler of [
      controller.list,
      controller.stats,
      controller.ban,
      controller.unban,
      controller.create,
    ]) {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.ADMIN]);
    }
    expect(Reflect.getMetadata(ROLES_KEY, controller.updateRole)).toEqual([
      Role.MASTER,
    ]);
  });

  it('passes the authenticated actor to moderation, never a client-supplied one', async () => {
    adminUsers.ban.mockResolvedValue({ user: {} as never });
    const req = { user: masterUser, body: { actorId: 'someone-else' } } as never;

    await controller.ban('target-1', { reason: 'Cheating' }, req);

    expect(adminUsers.ban).toHaveBeenCalledWith(masterUser, 'target-1', {
      reason: 'Cheating',
    });
  });
});
