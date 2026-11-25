import { Prisma, Role, UserStatus } from '@prisma/client';

/**
 * Who is ranked: active player accounts. Staff accounts (whose seeded ratings
 * are not earned) and banned players are left out. The leaderboard and the
 * profile's globalRank both rank this population, so they always agree.
 */
export const RANKED_PLAYERS = {
  role: Role.USER,
  status: UserStatus.ACTIVE,
} satisfies Prisma.UserWhereInput;
