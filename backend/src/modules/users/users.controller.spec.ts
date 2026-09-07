import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;
  let profilesService: jest.Mocked<
    Pick<ProfilesService, 'getMyProfile' | 'getPublicProfile' | 'updateMyProfile'>
  >;

  const authUser: AuthenticatedUser = {
    id: 'user-1',
    username: 'kevin',
    email: 'kevin@example.com',
    role: Role.USER,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    usersService = { findById: jest.fn() };
    profilesService = {
      getMyProfile: jest.fn(),
      getPublicProfile: jest.fn(),
      updateMyProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: ProfilesService, useValue: profilesService },
      ],
    }).compile();

    controller = module.get(UsersController);
  });

  it('getMyProfile delegates to ProfilesService using the authenticated user id', async () => {
    profilesService.getMyProfile.mockResolvedValue({ success: true } as never);
    const req = { user: authUser } as never;

    await controller.getMyProfile(req);

    expect(profilesService.getMyProfile).toHaveBeenCalledWith('user-1');
  });

  it('updateMyProfile delegates to ProfilesService with the user id and dto', async () => {
    profilesService.updateMyProfile.mockResolvedValue({ success: true } as never);
    const req = { user: authUser } as never;
    const dto = { displayName: 'Tyler' };

    await controller.updateMyProfile(req, dto);

    expect(profilesService.updateMyProfile).toHaveBeenCalledWith('user-1', dto);
  });

  it('getPublicProfile delegates to ProfilesService using the username param', async () => {
    profilesService.getPublicProfile.mockResolvedValue({ success: true } as never);

    await controller.getPublicProfile('kevin');

    expect(profilesService.getPublicProfile).toHaveBeenCalledWith('kevin');
  });

  it('requires authentication for /me, /me/profile (GET) and /me/profile (PATCH)', () => {
    for (const handler of [
      controller.me,
      controller.getMyProfile,
      controller.updateMyProfile,
    ]) {
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler);
      expect(guards).toContain(JwtAuthGuard);
    }
  });

  it('does not guard the public profile route', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller.getPublicProfile);
    expect(guards ?? []).not.toContain(JwtAuthGuard);
  });
});
