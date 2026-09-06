import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import {
  EmailAlreadyExistsException,
  InvalidCredentialsException,
  UsernameAlreadyExistsException,
} from '../../common/exceptions/app.exception';
import { hashPassword } from '../../common/security/password.util';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      'findByEmail' | 'findByEmailOrUsername' | 'create' | 'findById'
    >
  >;

  const baseUser = {
    id: 'user-1',
    username: 'kevin',
    email: 'kevin@example.com',
    role: Role.PLAYER,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findByEmailOrUsername: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const values: Record<string, string> = {
                JWT_ACCESS_SECRET: 'test-access-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return values[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('creates a user, hashes the password, and returns tokens with a safe user', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);

      const result = await service.register(
        'Kevin@Example.com',
        'kevin',
        'securePassword123',
      );

      expect(usersService.findByEmailOrUsername).toHaveBeenCalledWith(
        'kevin@example.com',
        'kevin',
      );
      const createArg = usersService.create.mock.calls[0][0];
      expect(createArg.email).toBe('kevin@example.com');
      expect(createArg.passwordHash).not.toBe('securePassword123');

      expect(result.user).toEqual({
        id: baseUser.id,
        username: baseUser.username,
        email: baseUser.email,
        createdAt: baseUser.createdAt,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('rejects registration with a duplicate email', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue({
        ...baseUser,
        passwordHash: 'x',
      } as never);

      await expect(
        service.register('kevin@example.com', 'someoneelse', 'password123'),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsException);
    });

    it('rejects registration with a duplicate username', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue({
        ...baseUser,
        email: 'other@example.com',
        passwordHash: 'x',
      } as never);

      await expect(
        service.register('new@example.com', 'kevin', 'password123'),
      ).rejects.toBeInstanceOf(UsernameAlreadyExistsException);
    });
  });

  describe('login', () => {
    it('logs in with correct credentials and never exposes the password hash', async () => {
      const passwordHash = await hashPassword('securePassword123');
      usersService.findByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash,
      } as never);

      const result = await service.login(
        'kevin@example.com',
        'securePassword123',
      );

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.tokens.accessToken).toEqual(expect.any(String));
    });

    it('rejects an incorrect password with a generic error', async () => {
      const passwordHash = await hashPassword('securePassword123');
      usersService.findByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash,
      } as never);

      await expect(
        service.login('kevin@example.com', 'wrong-password'),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
    });

    it('rejects an unknown email with the same generic error as a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('nobody@example.com', 'whatever123'),
      ).rejects.toThrow(InvalidCredentialsException);

      try {
        await service.login('nobody@example.com', 'whatever123');
      } catch (err) {
        expect((err as InvalidCredentialsException).message).toBe(
          'Invalid email or password',
        );
      }
    });
  });

  describe('refresh', () => {
    it('rejects an invalid or garbage refresh token', async () => {
      await expect(service.refresh('not-a-real-token')).rejects.toThrow();
    });

    it('issues new tokens for a valid refresh token', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);
      const { tokens } = await service.register(
        'kevin@example.com',
        'kevin',
        'securePassword123',
      );

      usersService.findById.mockResolvedValue(baseUser as never);

      const refreshed = await service.refresh(tokens.refreshToken);
      expect(refreshed.tokens.accessToken).toEqual(expect.any(String));
      expect(refreshed.user.id).toBe(baseUser.id);
    });

    it('rejects reuse of an access token as a refresh token', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);
      const { tokens } = await service.register(
        'kevin@example.com',
        'kevin',
        'securePassword123',
      );

      await expect(service.refresh(tokens.accessToken)).rejects.toThrow();
    });
  });
});
