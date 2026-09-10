import type {
  Challenge,
  ChallengeTag,
  ChallengeTestCase,
} from '@prisma/client';
import type {
  FunctionParameter,
  JsonValue,
  ValidationCheck,
} from '../challenges/challenge.types';

export type ChallengeWithRelations = Challenge & {
  testCases: ChallengeTestCase[];
  tags: ChallengeTag[];
};

function toParameters(value: unknown): FunctionParameter[] {
  return Array.isArray(value) ? (value as FunctionParameter[]) : [];
}

/**
 * Admin representation. Includes everything an author needs - hidden tests,
 * reference solution, checker and generator - and is only ever returned from
 * routes behind JwtAuthGuard + RolesGuard(ADMIN).
 */
export function toAdminChallenge(challenge: ChallengeWithRelations) {
  return {
    id: challenge.id,
    title: challenge.title,
    slug: challenge.slug,
    description: challenge.description,
    difficulty: challenge.difficulty,
    problemType: challenge.problemType,
    tags: challenge.tags.map((tag) => ({ slug: tag.slug, label: tag.label })),
    functionContract: {
      functionName: challenge.functionName,
      parameters: toParameters(challenge.parameters),
      returnType: challenge.returnType,
      starterCode: challenge.starterCode,
    },
    judge: {
      method: challenge.judgeMethod,
      referenceSolutionCode: challenge.referenceSolutionCode,
      customCheckerCode: challenge.customCheckerCode,
      testGeneratorCode: challenge.testGeneratorCode,
    },
    limits: {
      timeLimitMs: challenge.timeLimitMs,
      memoryLimitMb: challenge.memoryLimitMb,
      outputLimitKb: challenge.outputLimitKb,
    },
    roundTimeLimitSeconds: challenge.timeLimitSeconds,
    testCases: [...challenge.testCases]
      .sort((a, b) => a.order - b.order)
      .map((testCase) => ({
        id: testCase.id,
        order: testCase.order,
        isHidden: testCase.isHidden,
        input: testCase.input as JsonValue,
        expectedOutput: testCase.expectedOutput as JsonValue | null,
      })),
    status: challenge.status,
    creationMode: challenge.creationMode,
    validation: {
      status: challenge.validationStatus,
      validatedAt: challenge.validatedAt,
      checks: (challenge.validationChecks as unknown as ValidationCheck[]) ?? [],
    },
    createdById: challenge.createdById,
    createdAt: challenge.createdAt,
    updatedAt: challenge.updatedAt,
    publishedAt: challenge.publishedAt,
    archivedAt: challenge.archivedAt,
  };
}

/** Compact row for the admin challenge list. */
export function toAdminChallengeSummary(challenge: ChallengeWithRelations) {
  const testCases = challenge.testCases;
  return {
    id: challenge.id,
    title: challenge.title,
    slug: challenge.slug,
    difficulty: challenge.difficulty,
    status: challenge.status,
    creationMode: challenge.creationMode,
    judgeMethod: challenge.judgeMethod,
    validationStatus: challenge.validationStatus,
    tags: challenge.tags.map((tag) => tag.label),
    publicTestCount: testCases.filter((t) => !t.isHidden).length,
    hiddenTestCount: testCases.filter((t) => t.isHidden).length,
    createdAt: challenge.createdAt,
    updatedAt: challenge.updatedAt,
    publishedAt: challenge.publishedAt,
  };
}

/**
 * Player representation.
 *
 * Everything that could give a solution away is dropped here rather than
 * filtered by the caller: hidden test cases, the reference solution, the custom
 * checker, the generator, and the validation record. This function is the only
 * thing the player-facing controller returns.
 */
export function toPublicChallenge(challenge: ChallengeWithRelations) {
  return {
    id: challenge.id,
    title: challenge.title,
    slug: challenge.slug,
    description: challenge.description,
    difficulty: challenge.difficulty,
    problemType: challenge.problemType,
    tags: challenge.tags.map((tag) => tag.label),
    function: {
      name: challenge.functionName,
      parameters: toParameters(challenge.parameters),
      returnType: challenge.returnType,
      starterCode: challenge.starterCode,
    },
    limits: {
      timeLimitMs: challenge.timeLimitMs,
      memoryLimitMb: challenge.memoryLimitMb,
      outputLimitKb: challenge.outputLimitKb,
    },
    roundTimeLimitSeconds: challenge.timeLimitSeconds,
    publicTests: challenge.testCases
      .filter((testCase) => !testCase.isHidden)
      .sort((a, b) => a.order - b.order)
      .map((testCase) => ({
        order: testCase.order,
        input: testCase.input as JsonValue,
        expectedOutput: testCase.expectedOutput as JsonValue | null,
      })),
    publishedAt: challenge.publishedAt,
  };
}
