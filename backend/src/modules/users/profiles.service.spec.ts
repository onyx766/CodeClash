import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ProfilesService } from './profiles.service';
import { PrismaService } from '../../database/prisma.service';
import {
  ProfileNotFoundException,
  UsernameNotFoundException,
} from '../../common/exceptions/app.exception';

type MockPrisma = {
  user: { findUnique: jest.Mock };
  userStats: { count: jest.Mock };
  userProfile: { update: jest.Mock };
  userPreference: { update: jest.Mock };
  $transaction: jest.Mock;
};

describe('ProfilesService', () => {
  let service: ProfilesService;
  let prisma: MockPrisma;

  const fullUser = {
    id: 'user-1',
    username: 'kevin',
    email: 'kevin@example.com',
    passwordHash: 'super-secret-hash',
    role: Role.USER,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    profile: {
      displayName: 'Kevin',
      bio: 'Loves algorithms.',
      avatarUrl: null,
      location: 'San Francisco',
    },
    country: 'United States',
    region: 'California',
    city: 'San Francisco',
    timezone: 'America/Los_Angeles',
    stats: {
      rating: 1850,
      wins: 128,
      losses: 42,
      matchesPlayed: 170,
      bestStreak: 7,
      currentStreak: 3,
      challengesSolved: 128,
      coins: 2430,
      xp: 3450,
      draws: 4,
      casualWins: 9,
      casualLosses: 6,
      casualDraws: 1,
      casualMatchesPlayed: 16,
    },
    preferences: {
      favoriteLanguages: ['JavaScript', 'TypeScript'],
      favoriteTopics: ['Arrays', 'Graph'],
    },
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      userStats: { count: jest.fn() },
      userProfile: { update: jest.fn() },
      userPreference: { update: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ProfilesService);
  });

  describe('getMyProfile', () => {
    it('returns the full profile, computing winRate and globalRank', async () => {
      prisma.user.findUnique.mockResolvedValue(fullUser);
      prisma.userStats.count.mockResolvedValue(2); // 2 users rated higher

      const result = await service.getMyProfile('user-1');

      expect(result.user).toEqual({
        id: 'user-1',
        username: 'kevin',
        displayName: 'Kevin',
        bio: 'Loves algorithms.',
        avatarUrl: null,
        location: 'San Francisco',
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
        role: Role.USER,
        joinedAt: fullUser.createdAt,
      });
      expect(result.stats.globalRank).toBe(3);
      // Ranked among active players only, like the leaderboard.
      expect(prisma.userStats.count).toHaveBeenCalledWith({
        where: { rating: { gt: fullUser.stats.rating }, user: { role: 'USER', status: 'ACTIVE' } },
      });
      expect(result.stats.winRate).toBeCloseTo(75.29, 2);
      expect(result.stats.matchesPlayed).toBe(170);
      expect(result.stats.coins).toBe(2430);
      expect(result.stats).toMatchObject({
        draws: 4,
        casualWins: 9,
        casualLosses: 6,
        casualDraws: 1,
        casualMatchesPlayed: 16,
      });
      expect(result.preferences).toEqual({
        favoriteLanguages: ['JavaScript', 'TypeScript'],
        favoriteTopics: ['Arrays', 'Graph'],
      });
    });

    it('never leaks email or passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(fullUser);
      prisma.userStats.count.mockResolvedValue(0);

      const result = await service.getMyProfile('user-1');

      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain('kevin@example.com');
    });

    it('returns 0 winRate when no matches have been played', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...fullUser,
        stats: { ...fullUser.stats, wins: 0, matchesPlayed: 0 },
      });
      prisma.userStats.count.mockResolvedValue(0);

      const result = await service.getMyProfile('user-1');
      expect(result.stats.winRate).toBe(0);
    });

    it('throws ProfileNotFoundException when the profile/stats rows are missing', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...fullUser,
        profile: null,
      });

      await expect(service.getMyProfile('user-1')).rejects.toBeInstanceOf(
        ProfileNotFoundException,
      );
    });
  });

  describe('getPublicProfile', () => {
    it('returns a trimmed public shape without private stats fields', async () => {
      prisma.user.findUnique.mockResolvedValue(fullUser);
      prisma.userStats.count.mockResolvedValue(2);

      const result = await service.getPublicProfile('kevin');

      expect(result.user).not.toHaveProperty('id');
      expect(result.user).not.toHaveProperty('timezone');
      expect(result.user).toMatchObject({
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
      });
      expect(result.stats).not.toHaveProperty('matchesPlayed');
      expect(result.stats).not.toHaveProperty('coins');
      expect(result.stats).not.toHaveProperty('xp');
      expect(result.stats).not.toHaveProperty('currentStreak');
      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain('kevin@example.com');
    });

    it('throws UsernameNotFoundException (404) for an unknown username', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const promise = service.getPublicProfile('ghost');
      await expect(promise).rejects.toBeInstanceOf(UsernameNotFoundException);
      await expect(promise).rejects.toMatchObject({
        code: 'USERNAME_NOT_FOUND',
      });

      try {
        await service.getPublicProfile('ghost');
      } catch (err) {
        expect((err as UsernameNotFoundException).getStatus()).toBe(
          HttpStatus.NOT_FOUND,
        );
      }
    });
  });

  describe('updateMyProfile', () => {
    beforeEach(() => {
      prisma.$transaction.mockResolvedValue([{}, {}]);
      prisma.userStats.count.mockResolvedValue(0);
    });

    it('updates only the provided profile/preference fields', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
      prisma.user.findUnique.mockResolvedValueOnce(fullUser); // getMyProfile refetch

      await service.updateMyProfile('user-1', {
        displayName: 'Tyler',
        bio: 'JS developer who loves algorithms.',
      });

      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { displayName: 'Tyler', bio: 'JS developer who loves algorithms.' },
      });
      expect(prisma.userPreference.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {},
      });
    });

    it('ignores protected fields even if present on the input object', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
      prisma.user.findUnique.mockResolvedValueOnce(fullUser);

      await service.updateMyProfile('user-1', {
        displayName: 'Tyler',
        // Simulates a caller bypassing the DTO type; the service must not
        // let these through regardless of what TypeScript would normally stop.
        ...({ role: Role.MASTER, rating: 9999, coins: 999999 } as any),
      });

      const profileCallData = prisma.userProfile.update.mock.calls[0][0].data;
      expect(profileCallData).not.toHaveProperty('role');
      expect(profileCallData).not.toHaveProperty('rating');
      expect(profileCallData).not.toHaveProperty('coins');
    });

    it('throws ProfileNotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateMyProfile('missing', { displayName: 'x' }),
      ).rejects.toBeInstanceOf(ProfileNotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
