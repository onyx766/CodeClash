import { Role } from '@prisma/client';

/**
 * Numeric privilege level per role. Not persisted anywhere - Prisma's Role
 * enum stays the source of truth; this is only used in-memory to answer
 * "does role A outrank role B" without hardcoding every pair.
 */
export const ROLE_LEVEL: Record<Role, number> = {
  [Role.USER]: 1,
  [Role.ADMIN]: 2,
  [Role.MASTER]: 3,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minimum];
}

export function roleOutranks(role: Role, other: Role): boolean {
  return ROLE_LEVEL[role] > ROLE_LEVEL[other];
}
