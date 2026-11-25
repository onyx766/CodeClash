import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import type { StringValue } from 'ms';
import {
  hashPassword,
  verifyPassword,
} from '../../common/security/password.util';
import { isLocalOrPrivateIp } from '../../common/utils/client-ip.util';
import {
  AccountBannedException,
  EmailAlreadyExistsException,
  InvalidCredentialsException,
  UnauthenticatedException,
  UsernameAlreadyExistsException,
} from '../../common/exceptions/app.exception';
import { UsersService } from '../users/users.service';
import { isTokenRevoked } from './session-revocation.util';
import { GeolocationService } from '../geolocation/geolocation.service';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  SafeUser,
  TokenPair,
} from './auth.types';

interface UserPublicFields {
  id: string;
  username: string;
  email: string;
  role: Role;
  createdAt: Date;
  status: UserStatus;
  sessionsRevokedAt?: Date | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly geolocationService: GeolocationService,
  ) {}

  async register(
    email: string,
    username: string,
    password: string,
    ip?: string | null,
  ): Promise<{ user: SafeUser; tokens: TokenPair }> {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await this.usersService.findByEmailOrUsername(
      normalizedEmail,
      username,
    );
    if (existing) {
      if (existing.email === normalizedEmail) {
        throw new EmailAlreadyExistsException();
      }
      throw new UsernameAlreadyExistsException();
    }

    const passwordHash = await hashPassword(password);

    const user = await this.usersService.create({
      email: normalizedEmail,
      username,
      passwordHash,
    });

    const tokens = this.generateTokens(user);

    await this.detectAndUpdateLocation(user.id, ip);

    return { user: this.toSafeUser(user), tokens };
  }

  async login(
    email: string,
    password: string,
    ip?: string | null,
  ): Promise<{ user: SafeUser; tokens: TokenPair }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new InvalidCredentialsException();
    }

    const passwordValid = await verifyPassword(user.passwordHash, password);
    if (!passwordValid) {
      throw new InvalidCredentialsException();
    }

    // Checked only after the password, so a banned account is indistinguishable
    // from a wrong password to anyone who does not already know the password.
    if (user.status === UserStatus.BANNED) {
      throw new AccountBannedException(
        user.banReason
          ? `This account has been suspended: ${user.banReason}`
          : 'This account has been suspended.',
      );
    }

    const tokens = this.generateTokens(user);

    await this.touchLastActive(user.id);
    await this.detectAndUpdateLocation(user.id, ip);

    return { user: this.toSafeUser(user), tokens };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ user: SafeUser; tokens: TokenPair }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        { secret: this.config.get<string>('JWT_REFRESH_SECRET') },
      );
    } catch {
      throw new UnauthenticatedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthenticatedException('Invalid or expired refresh token');
    }

    const record = await this.findUserById(payload.sub);
    if (!record) {
      throw new UnauthenticatedException('Invalid or expired refresh token');
    }

    // A ban applies at the next refresh too, so an outstanding refresh token
    // cannot be traded for a fresh access token after the account is banned.
    if (record.status === UserStatus.BANNED) {
      throw new AccountBannedException();
    }

    // Revoking a user's sessions (e.g. an admin password reset) must end
    // them for good: a refresh token issued before that point cannot be
    // exchanged for new tokens, just as the JWT strategy rejects such an
    // access token.
    if (isTokenRevoked(payload.iat, record.sessionsRevokedAt)) {
      throw new UnauthenticatedException('Invalid or expired refresh token');
    }

    const tokens = this.generateTokens(record);
    await this.touchLastActive(record.id);
    return { user: this.toSafeUser(record), tokens };
  }

  /**
   * Records that an account authenticated. Best-effort: this drives the admin
   * console's "Last Active" column and must never fail a sign-in.
   */
  private async touchLastActive(userId: string): Promise<void> {
    try {
      await this.usersService.touchLastActive(userId);
    } catch {
      // ignored on purpose
    }
  }

  private async findUserById(id: string): Promise<UserPublicFields | null> {
    try {
      return await this.usersService.findById(id);
    } catch {
      return null;
    }
  }

  private generateTokens(user: UserPublicFields): TokenPair {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      role: user.role,
      type: 'refresh',
    };

    // No expiresIn - the access token never expires (no `exp` claim).
    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
      ) as StringValue,
    });

    return { accessToken, refreshToken };
  }

  private toSafeUser(user: UserPublicFields): SafeUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  /**
   * Best-effort location enrichment. Never allowed to fail registration or
   * login - any error (private IP, provider down, timeout, DB hiccup) is
   * swallowed here so the caller's auth flow is unaffected.
   */
  private async detectAndUpdateLocation(
    userId: string,
    ip: string | null | undefined,
  ): Promise<void> {
    try {
      const resolvedIp = this.resolveIpForGeolocation(ip);
      if (!resolvedIp) return;

      const location =
        await this.geolocationService.getLocationFromIp(resolvedIp);
      if (!location) return;

      await this.usersService.updateLocation(userId, location);
    } catch (err) {
      this.logger.debug(
        `Skipping geolocation update for user ${userId}: ${
          (err as Error).message
        }`,
      );
    }
  }

  /**
   * Real public IPs are used as-is. Local/private IPs (the norm in dev) are
   * only geolocated if GEOLOCATION_DEV_IP is explicitly set outside production.
   */
  private resolveIpForGeolocation(
    ip: string | null | undefined,
  ): string | null {
    if (ip && !isLocalOrPrivateIp(ip)) {
      return ip;
    }

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      const devIp = this.config.get<string>('GEOLOCATION_DEV_IP');
      if (devIp) return devIp;
    }

    return null;
  }
}
