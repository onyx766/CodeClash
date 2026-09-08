import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from '../constants/auth.constants';
import { TokenPair } from '../../modules/auth/auth.types';

function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 15 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return amount * unitMs;
}

// The access token itself carries no `exp` claim (see AuthService.generateTokens),
// so its cookie shouldn't clip it short - keep it around for a practical "forever".
const ACCESS_COOKIE_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export function setAuthCookies(
  res: Response,
  tokens: TokenPair,
  config: ConfigService,
): void {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const refreshMaxAge = parseDurationMs(
    config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
  );

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: ACCESS_TOKEN_COOKIE_PATH,
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const isProd = config.get<string>('NODE_ENV') === 'production';

  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: ACCESS_TOKEN_COOKIE_PATH,
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
}
