import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        rating: true,
        wins: true,
        losses: true,
        totalScore: true,
        createdAt: true,
        role: true,
        email: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
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

  async create(data: {
    email: string;
    username: string;
    passwordHash: string;
    role?: Role;
  }) {
    return this.prisma.user.create({ data });
  }
}
