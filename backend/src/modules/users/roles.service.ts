import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  ForbiddenRoleChangeException,
  LastMasterRequiredException,
  UserNotFoundException,
} from '../../common/exceptions/app.exception';
import { SafeAdminUser } from './types/profile.types';

const SAFE_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Role changes are MASTER-only (enforced by RolesGuard on the route, and
   * re-checked here in case this method is ever called from elsewhere), and
   * the platform must never end up with zero MASTER accounts.
   */
  async changeRole(
    actorRole: Role,
    targetUserId: string,
    newRole: Role,
  ): Promise<SafeAdminUser> {
    if (actorRole !== Role.MASTER) {
      throw new ForbiddenRoleChangeException('Only MASTER accounts can change roles.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: SAFE_USER_SELECT,
    });
    if (!target) {
      throw new UserNotFoundException();
    }

    if (target.role === Role.MASTER && newRole !== Role.MASTER) {
      const masterCount = await this.prisma.user.count({
        where: { role: Role.MASTER },
      });
      if (masterCount <= 1) {
        throw new LastMasterRequiredException();
      }
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: SAFE_USER_SELECT,
    });
  }
}
