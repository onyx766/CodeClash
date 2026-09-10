import { Role } from '@prisma/client';

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  type: 'access';
  /** Issued-at, seconds. Set by jsonwebtoken; compared with sessionsRevokedAt. */
  iat?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  role: Role;
  type: 'refresh';
  /** Issued-at, seconds. Set by jsonwebtoken; compared with sessionsRevokedAt. */
  iat?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
