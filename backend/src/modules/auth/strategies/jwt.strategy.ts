import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { UserStatus } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { AccountBannedException } from '../../../common/exceptions/app.exception';
import { ACCESS_TOKEN_COOKIE } from '../../../common/constants/auth.constants';
import { AccessTokenPayload, AuthenticatedUser } from '../auth.types';
import { isTokenRevoked } from '../session-revocation.util';

function extractFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const accessSecret = config.get<string>('JWT_ACCESS_SECRET');
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException();
    }

    const user = await this.usersService
      .findById(payload.sub)
      .catch(() => null);
    if (!user) {
      throw new UnauthorizedException();
    }

    // The role and standing are re-read from the database on every request
    // rather than trusted from the token, so a ban (or a demotion) takes effect
    // immediately instead of when the access token happens to expire.
    if (user.status === UserStatus.BANNED) {
      throw new AccountBannedException();
    }

    // Ends a session immediately after an admin password reset (or a
    // self-service password change) instead of when the token expires.
    if (isTokenRevoked(payload.iat, user.sessionsRevokedAt)) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
