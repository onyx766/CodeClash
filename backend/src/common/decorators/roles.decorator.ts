import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Marks a route as requiring at least the lowest role passed in.
 * RolesGuard resolves this via the role hierarchy (USER < ADMIN < MASTER),
 * so `@Roles(Role.ADMIN)` also allows MASTER without listing it explicitly.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
