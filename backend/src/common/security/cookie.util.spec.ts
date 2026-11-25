import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { clearAuthCookies, setAuthCookies, useSecureCookies } from './cookie.util';

const config = (env: Record<string, unknown>) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService;

describe('cookie.util', () => {
  describe('useSecureCookies', () => {
    it('defaults to Secure only in production', () => {
      expect(useSecureCookies(config({ NODE_ENV: 'production' }))).toBe(true);
      expect(useSecureCookies(config({ NODE_ENV: 'development' }))).toBe(false);
    });

    it.each([
      [false, false],
      ['false', false],
      [true, true],
      ['true', true],
    ])('COOKIE_SECURE=%p overrides NODE_ENV', (value, expected) => {
      expect(
        useSecureCookies(config({ NODE_ENV: 'production', COOKIE_SECURE: value })),
      ).toBe(expected);
      expect(
        useSecureCookies(config({ NODE_ENV: 'development', COOKIE_SECURE: value })),
      ).toBe(expected);
    });
  });

  it('applies the same Secure flag when setting and clearing cookies', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    const cfg = config({ NODE_ENV: 'production', COOKIE_SECURE: 'false' });

    setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' }, cfg);
    clearAuthCookies(res, cfg);

    for (const call of [
      ...(res.cookie as jest.Mock).mock.calls,
      ...(res.clearCookie as jest.Mock).mock.calls,
    ]) {
      expect(call[call.length - 1]).toEqual(
        expect.objectContaining({ secure: false, httpOnly: true, sameSite: 'lax' }),
      );
    }
  });
});
