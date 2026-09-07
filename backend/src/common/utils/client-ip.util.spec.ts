import type { Request } from 'express';
import { getClientIp, isLocalOrPrivateIp, normalizeIp } from './client-ip.util';

describe('normalizeIp', () => {
  it('strips the IPv4-mapped IPv6 prefix', () => {
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
  });

  it('leaves plain IPv4 and IPv6 addresses unchanged', () => {
    expect(normalizeIp('203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeIp('::1')).toBe('::1');
  });
});

describe('isLocalOrPrivateIp', () => {
  it('treats loopback addresses as local', () => {
    expect(isLocalOrPrivateIp('127.0.0.1')).toBe(true);
    expect(isLocalOrPrivateIp('::1')).toBe(true);
    expect(isLocalOrPrivateIp('::ffff:127.0.0.1')).toBe(true);
  });

  it('treats RFC1918 private ranges as local', () => {
    expect(isLocalOrPrivateIp('10.0.0.5')).toBe(true);
    expect(isLocalOrPrivateIp('192.168.1.20')).toBe(true);
    expect(isLocalOrPrivateIp('172.16.0.1')).toBe(true);
    expect(isLocalOrPrivateIp('172.31.255.255')).toBe(true);
  });

  it('does not treat addresses just outside the 172.16-172.31 range as private', () => {
    expect(isLocalOrPrivateIp('172.15.0.1')).toBe(false);
    expect(isLocalOrPrivateIp('172.32.0.1')).toBe(false);
  });

  it('treats link-local and IPv6 unique-local addresses as local', () => {
    expect(isLocalOrPrivateIp('169.254.1.1')).toBe(true);
    expect(isLocalOrPrivateIp('fe80::1')).toBe(true);
    expect(isLocalOrPrivateIp('fd00::1')).toBe(true);
  });

  it('treats a real public IP as not private', () => {
    expect(isLocalOrPrivateIp('8.8.8.8')).toBe(false);
    expect(isLocalOrPrivateIp('203.0.113.5')).toBe(false);
  });
});

function mockRequest(ip: string | undefined, remoteAddress?: string): Request {
  return { ip, socket: { remoteAddress } } as unknown as Request;
}

describe('getClientIp', () => {
  it('parses a plain IPv4 address from req.ip', () => {
    expect(getClientIp(mockRequest('203.0.113.5'))).toBe('203.0.113.5');
  });

  it('normalizes an IPv4-mapped IPv6 address from req.ip', () => {
    expect(getClientIp(mockRequest('::ffff:203.0.113.5'))).toBe('203.0.113.5');
  });

  it('falls back to the socket remote address when req.ip is absent', () => {
    expect(getClientIp(mockRequest(undefined, '198.51.100.9'))).toBe(
      '198.51.100.9',
    );
  });

  it('returns null when no IP is available', () => {
    expect(getClientIp(mockRequest(undefined))).toBeNull();
  });
});
