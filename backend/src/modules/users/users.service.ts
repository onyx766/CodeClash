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
      },
    });
    if (!user) throw new UserNotFoundException();
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findByEmailOrUsername(email: string, username: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
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
