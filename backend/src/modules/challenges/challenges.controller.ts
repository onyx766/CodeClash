import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';
import { ChallengesService } from './challenges.service';

/**
 * Public challenge catalogue.
 *
 * Authoring lives in AdminChallengesController (`/api/admin/challenges`) behind
 * JwtAuthGuard + RolesGuard - deliberately not here, so no admin surface is
 * reachable through the player-facing service.
 */
@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  list(@Query('difficulty') difficulty?: string, @Query('tag') tag?: string) {
    const parsed =
      difficulty && Object.values(Difficulty).includes(difficulty as Difficulty)
        ? (difficulty as Difficulty)
        : undefined;
    return this.challenges.listPublished({ difficulty: parsed, tag: tag?.slice(0, 64) });
  }

  @Get(':idOrSlug')
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.challenges.findPublished(idOrSlug);
  }
}
