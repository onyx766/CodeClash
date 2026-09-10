import { Injectable } from '@nestjs/common';
import { ChallengeStatus, Difficulty, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ChallengeNotFoundException } from '../../common/exceptions/app.exception';
import { toPublicChallenge } from '../admin-challenges/challenge.serializer';

const RELATIONS = {
  // Hidden test cases are excluded at the query level, not filtered afterwards:
  // they never enter a player-facing object in the first place.
  testCases: { where: { isHidden: false }, orderBy: { order: 'asc' } },
  tags: true,
} satisfies Prisma.ChallengeInclude;

/**
 * Player-facing challenge reads.
 *
 * Only PUBLISHED challenges are visible - drafts and archived challenges are
 * invisible here - and every response goes through toPublicChallenge(), which
 * omits hidden tests, the reference solution, the custom checker, the test
 * generator and the validation record.
 */
@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(options: { difficulty?: Difficulty; tag?: string } = {}) {
    const challenges = await this.prisma.challenge.findMany({
      where: {
        status: ChallengeStatus.PUBLISHED,
        ...(options.difficulty ? { difficulty: options.difficulty } : {}),
        ...(options.tag ? { tags: { some: { slug: options.tag } } } : {}),
      },
      include: RELATIONS,
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });

    return {
      challenges: challenges.map((challenge) => {
        const view = toPublicChallenge(challenge);
        // The list view does not need starter code or sample tests.
        const { publicTests, function: fn, ...summary } = view;
        return {
          ...summary,
          publicTestCount: publicTests.length,
          function: {
            name: fn.name,
            parameters: fn.parameters,
            returnType: fn.returnType,
          },
        };
      }),
    };
  }

  /** Accepts either the slug (preferred) or the uuid. */
  async findPublished(idOrSlug: string) {
    const challenge = await this.prisma.challenge.findFirst({
      where: {
        status: ChallengeStatus.PUBLISHED,
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
      },
      include: RELATIONS,
    });
    if (!challenge) throw new ChallengeNotFoundException();
    return { challenge: toPublicChallenge(challenge) };
  }
}
