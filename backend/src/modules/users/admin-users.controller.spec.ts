import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { AdminUsersController } from './admin-users.controller';
import { RolesService } from './roles.service';
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

  beforeEach(async () => {
    rolesService = { changeRole: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: RolesService, useValue: rolesService }],
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
});
