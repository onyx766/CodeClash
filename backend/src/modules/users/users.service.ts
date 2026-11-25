import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserNotFoundException } from '../../common/exceptions/app.exception';
import { GeoLocation } from '../geolocation/geolocation.types';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        // Included so the JWT strategy can reject a token that belongs to an
        // account banned - or whose sessions were revoked - after it was issued.
        status: true,
        sessionsRevokedAt: true,
      },
    });
    if (!user) throw new UserNotFoundException();
    return user;
  }

  /**
   * Stamps the account as having just authenticated. Drives the admin
   * console's "Last Active" column; never part of a user-editable DTO.
   */
  async touchLastActive(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  /** The stored hash, for verifying a password; null when the user is gone. */
  async findPasswordHash(id: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { passwordHash: true },
    });
    return user?.passwordHash ?? null;
  }

  /**
   * Replaces the password and revokes every session issued before
   * `revokedAt` (JwtStrategy and the refresh path refuse older tokens).
   */
  async setPassword(id: string, passwordHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, sessionsRevokedAt: revokedAt },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  /**
   * Usernames are unique case-insensitively ("Alice" and "alice" would be
   * indistinguishable in the UI); the admin console applies the same rule.
   */
  async findByEmailOrUsername(email: string, username: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: { equals: username, mode: 'insensitive' } }],
      },
    });
  }

  /**
   * New accounts always get USER (never trust a caller-supplied role) plus
   * their supporting profile/stats/preferences rows, created atomically with
   * the user via Prisma's nested-write transaction so registration can never
   * leave a user without them.
   */
  async create(data: { email: string; username: string; passwordHash: string }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        role: Role.USER,
        profile: { create: {} },
        stats: { create: {} },
        preferences: { create: {} },
      },
    });
  }

  /**
   * Writes IP-derived location fields only. Not reachable through any
   * user-facing profile DTO - these are automatically detected, not
   * user-editable.
   */
  async updateLocation(userId: string, location: GeoLocation): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        country: location.country,
        region: location.region,
        city: location.city,
        timezone: location.timezone,
      },
    });
  }
}
