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


/**
 * Whether auth cookies carry the Secure attribute. COOKIE_SECURE wins when
 * set; otherwise production uses Secure cookies. Browsers drop Secure cookies
 * set over plain http:// (except, in some browsers, on localhost), so a
 * deployment served without TLS - e.g. a LAN host running docker-compose -
 * must set COOKIE_SECURE=false or nobody can stay logged in.
 */
export function useSecureCookies(config: ConfigService): boolean {
  const explicit = config.get<string | boolean>('COOKIE_SECURE');
  if (explicit === true || explicit === 'true') return true;
  if (explicit === false || explicit === 'false') return false;
  return config.get<string>('NODE_ENV') === 'production';
}

export function setAuthCookies(
  res: Response,
  tokens: TokenPair,
  config: ConfigService,
): void {
  const secure = useSecureCookies(config);
  const refreshMaxAge = parseDurationMs(
    config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
  );
  // The cookie lives exactly as long as the token inside it.
  const accessMaxAge = parseDurationMs(
    config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
  );

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: ACCESS_TOKEN_COOKIE_PATH,
    maxAge: accessMaxAge,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const secure = useSecureCookies(config);

  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: ACCESS_TOKEN_COOKIE_PATH,
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
}
