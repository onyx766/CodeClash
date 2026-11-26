import { Injectable } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { hashPassword } from '../../common/security/password.util';
import { roleOutranks } from '../../common/constants/role-hierarchy';
import {
  CannotModerateSelfException,
  EmailAlreadyExistsException,
  InsufficientRankException,
  UserAlreadyInStateException,
  UserNotFoundException,
  UsernameAlreadyExistsException,
} from '../../common/exceptions/app.exception';
import type { ListUsersDto } from './dto/list-users.dto';
import type { BanUserDto, CreateUserDto } from './dto/moderate-user.dto';
import type {
  AdminResetPasswordDto,
  AdminUpdateUserDto,
} from './dto/admin-update-user.dto';
import type { AuthenticatedUser } from '../auth/auth.types';

const LIST_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  lastActiveAt: true,
  bannedAt: true,
  banReason: true,
  country: true,
  region: true,
  city: true,
  stats: { select: { rating: true, matchesPlayed: true, wins: true, losses: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof LIST_SELECT }>;

/** Edit-panel view: the list row plus profile and the full stats row. */
const DETAIL_SELECT = {
  ...LIST_SELECT,
  sessionsRevokedAt: true,
  profile: {
    select: { displayName: true, bio: true, location: true, avatarUrl: true },
  },
  stats: {
    select: {
      rating: true,
      matchesPlayed: true,
      wins: true,
      losses: true,
      currentStreak: true,
      bestStreak: true,
      challengesSolved: true,
      coins: true,
      xp: true,
    },
  },
} satisfies Prisma.UserSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

const JOIN_WINDOW_MS: Record<string, number> = {
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
  '90d': 90 * DAY_MS,
  '1y': 365 * DAY_MS,
};

function serialize(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    rating: user.stats?.rating ?? null,
    matchesPlayed: user.stats?.matchesPlayed ?? 0,
    country: user.country,
    region: user.region,
    city: user.city,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
    bannedAt: user.bannedAt,
    banReason: user.banReason,
  };
}

export type AdminUserView = ReturnType<typeof serialize>;

/**
 * Admin user management.
 *
 * Two rules run through every mutating method here:
 *
 *  - an actor may only moderate accounts they strictly outrank, so an ADMIN can
 *    never ban or re-role another ADMIN or a MASTER;
 *  - nobody moderates their own account.
 *
 * Both are enforced here rather than in the controller, because RolesGuard only
 * answers "is this caller at least an ADMIN" - it knows nothing about the
 * target of the request.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
  ) {}

  // -------------------------------------------------------------------------
  // reads
  // -------------------------------------------------------------------------

  async list(query: ListUsersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.joinedWithin
        ? {
            createdAt: {
              gte: new Date(Date.now() - JOIN_WINDOW_MS[query.joinedWithin]),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { id: search },
            ],
          }
        : {}),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir ?? 'desc';
    const orderBy: Prisma.UserOrderByWithRelationInput =
      sortBy === 'rating'
        ? { stats: { rating: sortDir } }
        : sortBy === 'lastActiveAt'
          ? // Accounts that have never signed in sort last rather than first.
            { lastActiveAt: { sort: sortDir, nulls: 'last' } }
          : { [sortBy]: sortDir };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: LIST_SELECT,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      users: users.map(serialize),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /**
   * Counters for the dashboard cards. "Active" means not banned, matching the
   * Status column, and each delta compares the last 30 days with the 30 before
   * it so the percentages describe real movement rather than all-time totals.
   */
  async stats() {
    const now = Date.now();
    const last30 = new Date(now - 30 * DAY_MS);
    const previous30 = new Date(now - 60 * DAY_MS);

    const [total, active, banned, newLast30, newPrevious30, bannedLast30] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
        this.prisma.user.count({ where: { status: UserStatus.BANNED } }),
        this.prisma.user.count({ where: { createdAt: { gte: last30 } } }),
        this.prisma.user.count({
          where: { createdAt: { gte: previous30, lt: last30 } },
        }),
        this.prisma.user.count({ where: { bannedAt: { gte: last30 } } }),
      ]);

    // Growth over a period that started from zero is reported as null rather
    // than as a fake 100%.
    const percentChange = (current: number, previous: number) =>
      previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;

    const activeBefore = total - newLast30 - (banned - bannedLast30);

    return {
      stats: {
        total: {
          value: total,
          changeThisMonth: newLast30,
          percentChange: percentChange(total, total - newLast30),
        },
        active: {
          value: active,
          changeThisMonth: active - activeBefore,
          percentChange: percentChange(active, activeBefore),
        },
        newUsers: {
          value: newLast30,
          changeThisMonth: newLast30,
          percentChange: percentChange(newLast30, newPrevious30),
        },
        banned: {
          value: banned,
          changeThisMonth: bannedLast30,
          percentChange: percentChange(banned, banned - bannedLast30),
        },
      },
    };
  }

  async getById(userId: string): Promise<AdminUserView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: LIST_SELECT,
    });
    if (!user) throw new UserNotFoundException();
    return serialize(user);
  }

  /** Everything the edit panel shows: the list row plus profile and stats. */
  async getDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: DETAIL_SELECT,
    });
    if (!user) throw new UserNotFoundException();
    return {
      ...serialize(user),
      profile: {
        displayName: user.profile?.displayName ?? null,
        bio: user.profile?.bio ?? null,
        location: user.profile?.location ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
      },
      stats: user.stats
        ? {
            rating: user.stats.rating,
            matchesPlayed: user.stats.matchesPlayed,
            wins: user.stats.wins,
            losses: user.stats.losses,
            currentStreak: user.stats.currentStreak,
            bestStreak: user.stats.bestStreak,
            challengesSolved: user.stats.challengesSolved,
            coins: user.stats.coins,
            xp: user.stats.xp,
          }
        : null,
      sessionsRevokedAt: user.sessionsRevokedAt,
    };
  }

  // -------------------------------------------------------------------------
  // editing
  // -------------------------------------------------------------------------

  /**
   * Edits account and profile details.
   *
   * Allowed on your own account (so a MASTER can fix their own typo) or on any
   * account you strictly outrank. Role and standing are not editable here -
   * they have their own endpoints with their own rules.
   */
  async update(actor: AuthenticatedUser, userId: string, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, username: true, email: true },
    });
    if (!target) throw new UserNotFoundException();

    if (actor.id !== userId && !roleOutranks(actor.role, target.role)) {
      throw new InsufficientRankException(
        'You can only edit your own account or accounts ranked below yours.',
      );
    }

    const emailChanged = dto.email !== undefined && dto.email !== target.email;
    const usernameChanged =
      dto.username !== undefined && dto.username !== target.username;

    if (emailChanged || usernameChanged) {
      const clash = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: [
            ...(emailChanged ? [{ email: dto.email }] : []),
            ...(usernameChanged
              ? [{ username: { equals: dto.username, mode: 'insensitive' as const } }]
              : []),
          ],
        },
        select: { email: true },
      });
      if (clash) {
        if (emailChanged && clash.email === dto.email) {
          throw new EmailAlreadyExistsException();
        }
        throw new UsernameAlreadyExistsException();
      }
    }

    // An empty string means "clear this field".
    const profileValue = (value: string | undefined) =>
      value === undefined ? undefined : value === '' ? null : value;
    const profile = {
      displayName: profileValue(dto.displayName),
      bio: profileValue(dto.bio),
      location: profileValue(dto.location),
      avatarUrl: profileValue(dto.avatarUrl),
    };
    const profileChanges = Object.fromEntries(
      Object.entries(profile).filter(([, value]) => value !== undefined),
    );

    // country/region/city live on User itself, not UserProfile.
    const userFields = {
      country: profileValue(dto.country),
      region: profileValue(dto.region),
      city: profileValue(dto.city),
    };
    const userFieldChanges = Object.fromEntries(
      Object.entries(userFields).filter(([, value]) => value !== undefined),
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        if (emailChanged || usernameChanged || Object.keys(userFieldChanges).length) {
          await tx.user.update({
            where: { id: userId },
            data: {
              ...(emailChanged ? { email: dto.email } : {}),
              ...(usernameChanged ? { username: dto.username } : {}),
              ...userFieldChanges,
            },
          });
        }
        if (Object.keys(profileChanges).length) {
          // Upsert: very old accounts may predate the profile row.
          await tx.userProfile.upsert({
            where: { userId },
            create: { userId, ...profileChanges },
            update: profileChanges,
          });
        }
      });
    } catch (error) {
      // A concurrent edit can still take the name between the check and the
      // write; the unique index is the final word.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const fields = String(error.meta?.target ?? '');
        if (fields.includes('email')) throw new EmailAlreadyExistsException();
        throw new UsernameAlreadyExistsException();
      }
      throw error;
    }

    return { user: await this.getDetail(userId) };
  }

  /**
   * Sets a new password and ends every existing session for the account.
   *
   * Access tokens are issued without an expiry, so a password change on its own
   * would leave anyone already holding a token signed in indefinitely.
   * sessionsRevokedAt makes JwtStrategy and the refresh path refuse any token
   * issued before this moment.
   */
  async resetPassword(
    actor: AuthenticatedUser,
    userId: string,
    dto: AdminResetPasswordDto,
  ) {
    await this.assertCanModerate(actor, userId);

    const revokedAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(dto.password),
        sessionsRevokedAt: revokedAt,
      },
    });
    // Live sockets were authenticated before the reset; close them.
    this.socket.disconnectUser(userId);

    return { success: true, sessionsRevokedAt: revokedAt };
  }

  // -------------------------------------------------------------------------
  // moderation
  // -------------------------------------------------------------------------

  async ban(actor: AuthenticatedUser, userId: string, dto: BanUserDto) {
    const target = await this.assertCanModerate(actor, userId);
    if (target.status === UserStatus.BANNED) {
      throw new UserAlreadyInStateException('This account is already banned.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.BANNED,
        bannedAt: new Date(),
        banReason: dto.reason?.trim() || null,
        bannedById: actor.id,
      },
      select: LIST_SELECT,
    });
    // HTTP and refresh reject banned accounts on the next request; open
    // sockets would otherwise keep receiving events.
    this.socket.disconnectUser(userId);
    return { user: serialize(user) };
  }

  async unban(actor: AuthenticatedUser, userId: string) {
    const target = await this.assertCanModerate(actor, userId);
    if (target.status === UserStatus.ACTIVE) {
      throw new UserAlreadyInStateException('This account is not banned.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        bannedAt: null,
        banReason: null,
        bannedById: null,
      },
      select: LIST_SELECT,
    });
    return { user: serialize(user) };
  }

  /**
   * Creates an account from the admin console. The new account's role is capped
   * by the actor's own: an ADMIN can create USERs, only a MASTER can create
   * another ADMIN or MASTER.
   */
  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const role = dto.role ?? Role.USER;
    if (role !== Role.USER && actor.role !== Role.MASTER) {
      throw new InsufficientRankException(
        'Only a MASTER can create ADMIN or MASTER accounts.',
      );
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true, username: true },
    });
    if (existing?.email === dto.email) throw new EmailAlreadyExistsException();
    if (existing) throw new UsernameAlreadyExistsException();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash: await hashPassword(dto.password),
        role,
        profile: { create: {} },
        stats: { create: {} },
        preferences: { create: {} },
      },
      select: LIST_SELECT,
    });
    return { user: serialize(user) };
  }

  // -------------------------------------------------------------------------

  /**
   * Shared guard for every mutating action: the target must exist, must not be
   * the actor, and must be ranked strictly below them.
   *
   * "Strictly below" means MASTER accounts can never be banned by anyone,
   * including another MASTER. That is deliberate - it removes any path to
   * locking the platform out of its own last MASTER account, so no separate
   * last-MASTER check is needed here.
   */
  private async assertCanModerate(actor: AuthenticatedUser, userId: string) {
    if (actor.id === userId) throw new CannotModerateSelfException();

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!target) throw new UserNotFoundException();

    if (!roleOutranks(actor.role, target.role)) {
      throw new InsufficientRankException();
    }

    return target;
  }
}
