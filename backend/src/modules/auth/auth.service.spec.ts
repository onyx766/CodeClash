import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { GeolocationService } from '../geolocation/geolocation.service';
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
      | 'findByEmail'
      | 'findByEmailOrUsername'
      | 'create'
      | 'findById'
      | 'updateLocation'
    >
  >;
  let geolocationService: jest.Mocked<Pick<GeolocationService, 'getLocationFromIp'>>;
  let configValues: Record<string, string>;

  const baseUser = {
    id: 'user-1',
    username: 'kevin',
    email: 'kevin@example.com',
    role: Role.USER,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findByEmailOrUsername: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      updateLocation: jest.fn(),
    };
    geolocationService = {
      getLocationFromIp: jest.fn(),
    };
    configValues = {
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      NODE_ENV: 'test',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: GeolocationService, useValue: geolocationService },
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => configValues[key],
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it.each([
      [['username'], 'USERNAME_ALREADY_EXISTS'],
      [['email'], 'EMAIL_ALREADY_EXISTS'],
    ])('turns a unique-constraint race on %p into a %s conflict', async (target, code) => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target },
        }),
      );

      await expect(
        service.register('kevin@example.com', 'kevin', 'securePassword123'),
      ).rejects.toMatchObject({ code });
    });

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

  describe('token lifetimes', () => {
    const claims = (jwt: string) =>
      JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')) as {
        iat: number;
        exp?: number;
      };

    it('issues access tokens that expire after JWT_ACCESS_EXPIRES_IN', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({ ...baseUser, passwordHash: 'hashed' } as never);

      const { tokens } = await service.register('kevin@example.com', 'kevin', 'securePassword123');

      const access = claims(tokens.accessToken);
      expect(access.exp).toBeDefined();
      expect(access.exp! - access.iat).toBe(15 * 60);
      const refresh = claims(tokens.refreshToken);
      expect(refresh.exp! - refresh.iat).toBe(7 * 24 * 60 * 60);
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

    it('rejects a refresh token issued before the sessions were revoked', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({ ...baseUser, passwordHash: 'hashed' } as never);
      const { tokens } = await service.register('kevin@example.com', 'kevin', 'securePassword123');

      // e.g. an admin reset the password a minute after this token was issued
      usersService.findById.mockResolvedValue({
        ...baseUser,
        sessionsRevokedAt: new Date(Date.now() + 60_000),
      } as never);

      await expect(service.refresh(tokens.refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('still refreshes tokens issued after an earlier revocation', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({ ...baseUser, passwordHash: 'hashed' } as never);
      const { tokens } = await service.register('kevin@example.com', 'kevin', 'securePassword123');

      usersService.findById.mockResolvedValue({
        ...baseUser,
        sessionsRevokedAt: new Date(Date.now() - 60 * 60_000),
      } as never);

      await expect(service.refresh(tokens.refreshToken)).resolves.toMatchObject({
        user: { id: baseUser.id },
      });
    });
  });

  describe('geolocation enrichment', () => {
    it('stores location on registration when the provider succeeds for a public IP', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);
      geolocationService.getLocationFromIp.mockResolvedValue({
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      });

      await service.register(
        'kevin@example.com',
        'kevin',
        'securePassword123',
        '203.0.113.5',
      );

      expect(geolocationService.getLocationFromIp).toHaveBeenCalledWith(
        '203.0.113.5',
      );
      expect(usersService.updateLocation).toHaveBeenCalledWith(baseUser.id, {
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      });
    });

    it('still succeeds registration when the geolocation provider fails', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);
      geolocationService.getLocationFromIp.mockRejectedValue(
        new Error('provider down'),
      );

      const result = await service.register(
        'kevin@example.com',
        'kevin',
        'securePassword123',
        '203.0.113.5',
      );

      expect(result.user.id).toBe(baseUser.id);
      expect(usersService.updateLocation).not.toHaveBeenCalled();
    });

    it('updates location on a successful login', async () => {
      const passwordHash = await hashPassword('securePassword123');
      usersService.findByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash,
      } as never);
      geolocationService.getLocationFromIp.mockResolvedValue({
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      });

      await service.login(
        'kevin@example.com',
        'securePassword123',
        '203.0.113.5',
      );

      expect(usersService.updateLocation).toHaveBeenCalledWith(
        baseUser.id,
        expect.objectContaining({ country: 'United States' }),
      );
    });

    it('does not call the geolocation provider for a failed login', async () => {
      const passwordHash = await hashPassword('securePassword123');
      usersService.findByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash,
      } as never);

      await expect(
        service.login('kevin@example.com', 'wrong-password', '203.0.113.5'),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);

      expect(geolocationService.getLocationFromIp).not.toHaveBeenCalled();
    });

    it('skips the provider entirely for a localhost IP', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);

      await service.register(
        'kevin@example.com',
        'kevin',
        'securePassword123',
        '127.0.0.1',
      );

      expect(geolocationService.getLocationFromIp).not.toHaveBeenCalled();
      expect(usersService.updateLocation).not.toHaveBeenCalled();
    });

    it('skips the provider entirely for a private network IP', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash: await hashPassword('securePassword123'),
      } as never);

      await service.login(
        'kevin@example.com',
        'securePassword123',
        '192.168.1.20',
      );

      expect(geolocationService.getLocationFromIp).not.toHaveBeenCalled();
      expect(usersService.updateLocation).not.toHaveBeenCalled();
    });

    it('uses GEOLOCATION_DEV_IP outside production when the real IP is local', async () => {
      configValues.GEOLOCATION_DEV_IP = '8.8.8.8';
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);
      geolocationService.getLocationFromIp.mockResolvedValue({
        country: 'United States',
        region: null,
        city: null,
        timezone: null,
      });

      await service.register(
        'kevin@example.com',
        'kevin',
        'securePassword123',
        '127.0.0.1',
      );

      expect(geolocationService.getLocationFromIp).toHaveBeenCalledWith(
        '8.8.8.8',
      );
    });

    it('ignores GEOLOCATION_DEV_IP in production', async () => {
      configValues.NODE_ENV = 'production';
      configValues.GEOLOCATION_DEV_IP = '8.8.8.8';
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);

      await service.register(
        'kevin@example.com',
        'kevin',
        'securePassword123',
        '127.0.0.1',
      );

      expect(geolocationService.getLocationFromIp).not.toHaveBeenCalled();
    });

    it('does not fail registration when no IP is available at all', async () => {
      usersService.findByEmailOrUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...baseUser,
        passwordHash: 'hashed',
      } as never);

      const result = await service.register(
        'kevin@example.com',
        'kevin',
        'securePassword123',
        null,
      );

      expect(result.user.id).toBe(baseUser.id);
      expect(geolocationService.getLocationFromIp).not.toHaveBeenCalled();
    });
  });
});
