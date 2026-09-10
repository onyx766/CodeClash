import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RoomsService } from '../rooms/rooms.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UnauthenticatedException } from '../../common/exceptions/app.exception';
import { AuthenticatedUser } from './auth.types';
import { Role } from '@prisma/client';

function mockResponse(): jest.Mocked<Response> {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as jest.Mocked<Response>;
}

function mockRequest(ip = '203.0.113.5'): Request {
  return { ip, socket: { remoteAddress: ip } } as unknown as Request;
}

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'register' | 'login' | 'refresh'>
  >;
  let roomsService: jest.Mocked<Pick<RoomsService, 'findActiveRoomForUser'>>;

  const safeUser = {
    id: 'user-1',
    username: 'kevin',
    email: 'kevin@example.com',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
    };
    roomsService = {
      findActiveRoomForUser: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: RoomsService, useValue: roomsService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'NODE_ENV' ? 'test' : '15m'),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('register sets auth cookies and returns the safe user, without a password hash', async () => {
    authService.register.mockResolvedValue({
      user: safeUser,
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    });
    const res = mockResponse();

    const result = await controller.register(
      {
        email: 'kevin@example.com',
        username: 'kevin',
        password: 'securePassword123',
      },
      mockRequest(),
      res,
    );

    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, user: safeUser });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('register forwards the detected client IP to the auth service', async () => {
    authService.register.mockResolvedValue({
      user: safeUser,
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    });

    await controller.register(
      {
        email: 'kevin@example.com',
        username: 'kevin',
        password: 'securePassword123',
      },
      mockRequest('198.51.100.9'),
      mockResponse(),
    );

    expect(authService.register).toHaveBeenCalledWith(
      'kevin@example.com',
      'kevin',
      'securePassword123',
      '198.51.100.9',
    );
  });

  it('login sets auth cookies and returns the safe user with no active room', async () => {
    authService.login.mockResolvedValue({
      user: safeUser,
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    });
    roomsService.findActiveRoomForUser.mockResolvedValue(null);
    const res = mockResponse();

    const result = await controller.login(
      { email: 'kevin@example.com', password: 'securePassword123' },
      mockRequest(),
      res,
    );

    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      success: true,
      user: safeUser,
      activeRoom: null,
    });
  });

  it('login returns the id/code of a room the user is already in', async () => {
    authService.login.mockResolvedValue({
      user: safeUser,
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    });
    roomsService.findActiveRoomForUser.mockResolvedValue({
      id: 'room-1',
      code: 'ABC123',
    } as Awaited<ReturnType<RoomsService['findActiveRoomForUser']>>);

    const result = await controller.login(
      { email: 'kevin@example.com', password: 'securePassword123' },
      mockRequest(),
      mockResponse(),
    );

    expect(roomsService.findActiveRoomForUser).toHaveBeenCalledWith(
      safeUser.id,
    );
    expect(result).toEqual({
      success: true,
      user: safeUser,
      activeRoom: { id: 'room-1', code: 'ABC123' },
    });
  });

  it('logout clears both auth cookies and returns success', () => {
    const res = mockResponse();
    const result = controller.logout(res);

    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
  });

  it('me returns the authenticated user attached by the guard', async () => {
    const user: AuthenticatedUser = { ...safeUser, role: Role.USER };
    const req = { user } as unknown as Parameters<typeof controller.me>[0];
    roomsService.findActiveRoomForUser.mockResolvedValue(null);

    const result = await controller.me(req);

    expect(result).toEqual({
      success: true,
      user: { ...safeUser, role: Role.USER },
      activeRoom: null,
    });
  });

  it('me includes the id/code of a room the user is already in', async () => {
    const user: AuthenticatedUser = { ...safeUser, role: Role.USER };
    const req = { user } as unknown as Parameters<typeof controller.me>[0];
    roomsService.findActiveRoomForUser.mockResolvedValue({
      id: 'room-1',
      code: 'ABC123',
    } as Awaited<ReturnType<RoomsService['findActiveRoomForUser']>>);

    const result = await controller.me(req);

    expect(result).toEqual({
      success: true,
      user: { ...safeUser, role: Role.USER },
      activeRoom: { id: 'room-1', code: 'ABC123' },
    });
  });

  it('me reports the caller their own role, so a console can render the right shell', async () => {
    const user: AuthenticatedUser = { ...safeUser, role: Role.ADMIN };
    const req = { user } as unknown as Parameters<typeof controller.me>[0];
    roomsService.findActiveRoomForUser.mockResolvedValue(null);

    const result = await controller.me(req);

    expect(result.user.role).toBe(Role.ADMIN);
  });
});

describe('JwtAuthGuard', () => {
  it('throws UnauthenticatedException when passport reports no user', () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(null, false)).toThrow(
      UnauthenticatedException,
    );
  });

  it('throws UnauthenticatedException when passport reports an error', () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(new Error('expired'), false)).toThrow(
      UnauthenticatedException,
    );
  });

  it('returns the user when authentication succeeds', () => {
    const guard = new JwtAuthGuard();
    const user: AuthenticatedUser = {
      id: 'user-1',
      username: 'kevin',
      email: 'kevin@example.com',
      role: Role.USER,
      createdAt: new Date(),
    };
    expect(guard.handleRequest(null, user)).toEqual(user);
  });
});
