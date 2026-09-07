import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ProfileNotFoundException,
  UsernameNotFoundException,
} from '../../common/exceptions/app.exception';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MyProfileResponse, PublicProfileResponse } from './types/profile.types';

const PROFILE_INCLUDE = {
  profile: true,
  stats: true,
  preferences: true,
} as const;

function calculateWinRate(wins: number, matchesPlayed: number): number {
  if (matchesPlayed <= 0) return 0;
  return Math.round((wins / matchesPlayed) * 10000) / 100;
}

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string): Promise<MyProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: PROFILE_INCLUDE,
    });
    if (!user || !user.profile || !user.stats || !user.preferences) {
      throw new ProfileNotFoundException();
    }

    const globalRank = await this.getGlobalRank(user.stats.rating);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.profile.displayName,
        avatarUrl: user.profile.avatarUrl,
        bio: user.profile.bio,
        location: user.profile.location,
        country: user.country,
        region: user.region,
        city: user.city,
        timezone: user.timezone,
        role: user.role,
        joinedAt: user.createdAt,
      },
      stats: {
        rating: user.stats.rating,
        globalRank,
        wins: user.stats.wins,
        losses: user.stats.losses,
        matchesPlayed: user.stats.matchesPlayed,
        winRate: calculateWinRate(user.stats.wins, user.stats.matchesPlayed),
        bestStreak: user.stats.bestStreak,
        currentStreak: user.stats.currentStreak,
        challengesSolved: user.stats.challengesSolved,
        coins: user.stats.coins,
        xp: user.stats.xp,
      },
      preferences: {
        favoriteLanguages: user.preferences.favoriteLanguages,
        favoriteTopics: user.preferences.favoriteTopics,
      },
    };
  }

  async getPublicProfile(username: string): Promise<PublicProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: PROFILE_INCLUDE,
    });
    if (!user) {
      throw new UsernameNotFoundException();
    }
    if (!user.profile || !user.stats || !user.preferences) {
      throw new ProfileNotFoundException();
    }

    const globalRank = await this.getGlobalRank(user.stats.rating);

    return {
      success: true,
      user: {
        username: user.username,
        displayName: user.profile.displayName,
        avatarUrl: user.profile.avatarUrl,
        bio: user.profile.bio,
        location: user.profile.location,
        country: user.country,
        region: user.region,
        city: user.city,
        role: user.role,
        joinedAt: user.createdAt,
      },
      stats: {
        rating: user.stats.rating,
        globalRank,
        wins: user.stats.wins,
        losses: user.stats.losses,
        winRate: calculateWinRate(user.stats.wins, user.stats.matchesPlayed),
        bestStreak: user.stats.bestStreak,
        challengesSolved: user.stats.challengesSolved,
      },
      preferences: {
        favoriteLanguages: user.preferences.favoriteLanguages,
        favoriteTopics: user.preferences.favoriteTopics,
      },
    };
  }

  /**
   * Explicitly maps only the editable profile/preference fields - never
   * spreads the DTO into Prisma's `data`, so a protected field slipping past
   * validation (role, rating, coins, ...) still could not reach the User row.
   */
  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<MyProfileResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) {
      throw new ProfileNotFoundException();
    }

    await this.prisma.$transaction([
      this.prisma.userProfile.update({
        where: { userId },
        data: {
          ...(dto.displayName !== undefined && {
            displayName: dto.displayName,
          }),
          ...(dto.bio !== undefined && { bio: dto.bio }),
          ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
          ...(dto.location !== undefined && { location: dto.location }),
        },
      }),
      this.prisma.userPreference.update({
        where: { userId },
        data: {
          ...(dto.favoriteLanguages !== undefined && {
            favoriteLanguages: dto.favoriteLanguages,
          }),
          ...(dto.favoriteTopics !== undefined && {
            favoriteTopics: dto.favoriteTopics,
          }),
        },
      }),
    ]);

    return this.getMyProfile(userId);
  }

  private async getGlobalRank(rating: number): Promise<number> {
    const higherRated = await this.prisma.userStats.count({
      where: { rating: { gt: rating } },
    });
    return higherRated + 1;
  }
}
