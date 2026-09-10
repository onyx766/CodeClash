import { Injectable } from '@nestjs/common';
import {
  ChallengeCreationMode,
  ChallengeStatus,
  ChallengeValidationStatus,
  Difficulty,
  JudgeMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  ChallengeAlreadyPublishedException,
  ChallengeInUseException,
  ChallengeLockedException,
  ChallengeNotFoundException,
  ChallengeNotValidatedException,
  ChallengeSlugExistsException,
  InvalidChallengeException,
  InvalidFunctionContractException,
  InvalidTestCaseException,
} from '../../common/exceptions/app.exception';
import {
  MAX_TEST_CASE_JSON_BYTES,
  MIN_HIDDEN_TESTS,
  MIN_PUBLIC_TESTS,
  SLUG_MAX_LENGTH,
} from '../challenges/challenge.constants';
import {
  buildStarterCode,
  sanitizeJsonValue,
  slugify,
  validateFunctionContract,
  validateTestCaseInput,
} from '../challenges/function-contract.util';
import { computeChallengeFingerprint } from '../challenges/challenge-fingerprint.util';
import type { FunctionParameter } from '../challenges/challenge.types';
import type { UpsertChallengeDto } from './dto/upsert-challenge.dto';
import type { TestCaseDto } from './dto/challenge-parts.dto';
import {
  ChallengeWithRelations,
  toAdminChallenge,
  toAdminChallengeSummary,
} from './challenge.serializer';

const RELATIONS = Prisma.validator<Prisma.ChallengeInclude>()({
  testCases: { orderBy: { order: 'asc' } },
  tags: true,
});

interface NormalizedTestCase {
  input: Prisma.InputJsonValue;
  /**
   * Prisma.DbNull writes a real SQL NULL, which is what "this test has no
   * stored expectation" means (as opposed to Prisma.JsonNull, which would
   * store the JSON value `null` and read back as a legitimate expectation).
   */
  expectedOutput: Prisma.InputJsonValue | typeof Prisma.DbNull;
  isHidden: boolean;
  order: number;
}

@Injectable()
export class AdminChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // reads
  // -------------------------------------------------------------------------

  async list(status?: ChallengeStatus, search?: string) {
    const challenges = await this.prisma.challenge.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { slug: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: RELATIONS,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { challenges: challenges.map(toAdminChallengeSummary) };
  }

  async getById(id: string) {
    return { challenge: toAdminChallenge(await this.loadOrThrow(id)) };
  }

  async loadOrThrow(id: string): Promise<ChallengeWithRelations> {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: RELATIONS,
    });
    if (!challenge) throw new ChallengeNotFoundException();
    return challenge;
  }

  // -------------------------------------------------------------------------
  // create / update
  // -------------------------------------------------------------------------

  /**
   * Creates a DRAFT. Never publishes, whatever the caller asked for - all three
   * creation modes (manual, AI, JSON import) funnel through here and land in
   * exactly the same state.
   */
  async create(
    userId: string,
    dto: UpsertChallengeDto,
    creationMode: ChallengeCreationMode = ChallengeCreationMode.MANUAL,
  ) {
    if (!dto.title) {
      throw new InvalidChallengeException('A title is required.');
    }

    const contract = dto.functionContract;
    const parameters = (contract?.parameters ?? []) as FunctionParameter[];
    const functionName = contract?.functionName ?? 'solve';

    if (contract) this.assertContract(contract);

    const slug = await this.resolveSlug(dto.slug ?? slugify(dto.title), null);
    const testCases = this.normalizeTestCases(dto.testCases ?? [], parameters);

    const challenge = await this.prisma.challenge.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description ?? '',
        difficulty: dto.difficulty ?? Difficulty.EASY,
        problemType: dto.problemType ?? undefined,
        functionName,
        parameters: parameters as unknown as Prisma.InputJsonValue,
        returnType: contract?.returnType ?? 'any',
        starterCode:
          contract?.starterCode ??
          buildStarterCode({ functionName, parameters, returnType: 'any' }),
        judgeMethod: dto.judgeMethod ?? JudgeMethod.DEEP_EQUAL,
        referenceSolutionCode: dto.referenceSolutionCode ?? null,
        customCheckerCode: dto.customCheckerCode ?? null,
        testGeneratorCode: dto.testGeneratorCode ?? null,
        timeLimitMs: dto.timeLimitMs ?? undefined,
        memoryLimitMb: dto.memoryLimitMb ?? undefined,
        outputLimitKb: dto.outputLimitKb ?? undefined,
        timeLimitSeconds: dto.timeLimitSeconds ?? undefined,
        // Always DRAFT and always NOT_CHECKED, by construction.
        status: ChallengeStatus.DRAFT,
        creationMode,
        validationStatus: ChallengeValidationStatus.NOT_CHECKED,
        createdById: userId,
        tags: await this.tagConnector(dto.tags),
        testCases: { create: testCases },
      },
      include: RELATIONS,
    });

    return { challenge: toAdminChallenge(challenge) };
  }

  async update(id: string, dto: UpsertChallengeDto) {
    const existing = await this.loadOrThrow(id);
    const touchesJudging = this.touchesJudging(dto);

    // A published challenge is being played, and Rounds point straight at it.
    // Presentational edits stay allowed; anything that could change a verdict
    // does not. See docs in the module README.
    if (existing.status === ChallengeStatus.PUBLISHED && touchesJudging) {
      throw new ChallengeLockedException();
    }

    const contract = dto.functionContract;
    if (contract) this.assertContract(contract);

    const parameters = (contract?.parameters ??
      (existing.parameters as unknown as FunctionParameter[]) ??
      []) as FunctionParameter[];

    const data: Prisma.ChallengeUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.problemType !== undefined) data.problemType = dto.problemType;
    if (dto.slug !== undefined) {
      data.slug = await this.resolveSlug(dto.slug, id, true);
    }
    if (contract) {
      data.functionName = contract.functionName;
      data.parameters = parameters as unknown as Prisma.InputJsonValue;
      data.returnType = contract.returnType;
      data.starterCode = contract.starterCode;
    }
    if (dto.judgeMethod !== undefined) data.judgeMethod = dto.judgeMethod;
    if (dto.referenceSolutionCode !== undefined) {
      data.referenceSolutionCode = dto.referenceSolutionCode || null;
    }
    if (dto.customCheckerCode !== undefined) {
      data.customCheckerCode = dto.customCheckerCode || null;
    }
    if (dto.testGeneratorCode !== undefined) {
      data.testGeneratorCode = dto.testGeneratorCode || null;
    }
    if (dto.timeLimitMs !== undefined) data.timeLimitMs = dto.timeLimitMs;
    if (dto.memoryLimitMb !== undefined) data.memoryLimitMb = dto.memoryLimitMb;
    if (dto.outputLimitKb !== undefined) data.outputLimitKb = dto.outputLimitKb;
    if (dto.timeLimitSeconds !== undefined) {
      data.timeLimitSeconds = dto.timeLimitSeconds;
    }
    if (dto.tags !== undefined) {
      data.tags = { set: [], ...(await this.tagConnector(dto.tags)) };
    }

    // Any edit that can change a verdict drops the challenge back to
    // NOT_CHECKED. publish() independently re-checks the fingerprint, so this
    // is defence in depth rather than the only guard.
    if (touchesJudging) {
      data.validationStatus = ChallengeValidationStatus.NOT_CHECKED;
      data.validatedAt = null;
      data.validationChecks = Prisma.DbNull;
      data.validationFingerprint = null;
    }

    const testCases =
      dto.testCases !== undefined
        ? this.normalizeTestCases(dto.testCases, parameters)
        : null;

    const challenge = await this.prisma.$transaction(async (tx) => {
      await tx.challenge.update({ where: { id }, data });
      if (testCases) {
        await tx.challengeTestCase.deleteMany({ where: { challengeId: id } });
        for (const testCase of testCases) {
          await tx.challengeTestCase.create({
            data: { challengeId: id, ...testCase },
          });
        }
      }
      return tx.challenge.findUniqueOrThrow({
        where: { id },
        include: RELATIONS,
      });
    });

    return { challenge: toAdminChallenge(challenge) };
  }

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------

  /**
   * Publish is the only way a challenge becomes visible to players, and it is
   * gated on server-side validation:
   *
   *   - the challenge must currently be a draft (or an archived one being
   *     restored) - re-publishing a live challenge is a no-op error;
   *   - the last validation run must have PASSED;
   *   - the judging fingerprint must still match what was validated, so a
   *     hidden test edited after a successful validation blocks publishing even
   *     if something forgot to reset validationStatus;
   *   - the publishing floor on test counts must be met.
   */
  async publish(id: string) {
    const challenge = await this.loadOrThrow(id);

    if (challenge.status === ChallengeStatus.PUBLISHED) {
      throw new ChallengeAlreadyPublishedException();
    }
    if (challenge.validationStatus !== ChallengeValidationStatus.PASSED) {
      throw new ChallengeNotValidatedException();
    }
    if (
      !challenge.validationFingerprint ||
      challenge.validationFingerprint !== this.fingerprint(challenge)
    ) {
      throw new ChallengeNotValidatedException(
        'This challenge changed after it was validated. Run Validate Problem again before publishing.',
      );
    }

    const problems = this.publishReadiness(challenge);
    if (problems.length) {
      throw new InvalidChallengeException(problems.join(' '));
    }

    const published = await this.prisma.$transaction(async (tx) => {
      // Conditional update: whoever gets here first flips the row, a racing
      // second publish finds no DRAFT/ARCHIVED row to update.
      const { count } = await tx.challenge.updateMany({
        where: {
          id,
          status: { in: [ChallengeStatus.DRAFT, ChallengeStatus.ARCHIVED] },
          validationStatus: ChallengeValidationStatus.PASSED,
          validationFingerprint: challenge.validationFingerprint,
        },
        data: {
          status: ChallengeStatus.PUBLISHED,
          publishedAt: new Date(),
          archivedAt: null,
        },
      });
      if (count === 0) throw new ChallengeAlreadyPublishedException();
      return tx.challenge.findUniqueOrThrow({
        where: { id },
        include: RELATIONS,
      });
    });

    return { challenge: toAdminChallenge(published) };
  }

  async archive(id: string) {
    const challenge = await this.loadOrThrow(id);
    if (challenge.status === ChallengeStatus.ARCHIVED) {
      return { challenge: toAdminChallenge(challenge) };
    }
    const archived = await this.prisma.challenge.update({
      where: { id },
      data: { status: ChallengeStatus.ARCHIVED, archivedAt: new Date() },
      include: RELATIONS,
    });
    return { challenge: toAdminChallenge(archived) };
  }

  /**
   * Hard delete, allowed only while nothing historical depends on the
   * challenge. A challenge that has ever been played is archived instead, so
   * finished matches and their submissions keep resolving.
   */
  async remove(id: string) {
    const challenge = await this.loadOrThrow(id);

    const roundCount = await this.prisma.round.count({
      where: { challengeId: id },
    });
    if (roundCount > 0) {
      throw new ChallengeInUseException(
        `This challenge has been used in ${roundCount} round(s) and cannot be deleted. Archive it instead.`,
      );
    }
    if (challenge.status === ChallengeStatus.PUBLISHED) {
      throw new ChallengeInUseException(
        'Published challenges cannot be deleted. Archive it first.',
      );
    }

    await this.prisma.challenge.delete({ where: { id } });
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // helpers shared with the validation service
  // -------------------------------------------------------------------------

  fingerprint(challenge: ChallengeWithRelations): string {
    return computeChallengeFingerprint({
      problemType: challenge.problemType,
      functionName: challenge.functionName,
      parameters: challenge.parameters,
      returnType: challenge.returnType,
      starterCode: challenge.starterCode,
      judgeMethod: challenge.judgeMethod,
      referenceSolutionCode: challenge.referenceSolutionCode,
      customCheckerCode: challenge.customCheckerCode,
      testGeneratorCode: challenge.testGeneratorCode,
      timeLimitMs: challenge.timeLimitMs,
      memoryLimitMb: challenge.memoryLimitMb,
      outputLimitKb: challenge.outputLimitKb,
      testCases: challenge.testCases.map((testCase) => ({
        order: testCase.order,
        isHidden: testCase.isHidden,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
      })),
    });
  }

  publishReadiness(challenge: ChallengeWithRelations): string[] {
    const problems: string[] = [];
    const publicTests = challenge.testCases.filter((t) => !t.isHidden).length;
    const hiddenTests = challenge.testCases.filter((t) => t.isHidden).length;

    if (!challenge.description.trim()) {
      problems.push('A description is required.');
    }
    if (publicTests < MIN_PUBLIC_TESTS) {
      problems.push(`At least ${MIN_PUBLIC_TESTS} public test case is required.`);
    }
    if (hiddenTests < MIN_HIDDEN_TESTS) {
      problems.push(`At least ${MIN_HIDDEN_TESTS} hidden test cases are required.`);
    }
    return problems;
  }

  // -------------------------------------------------------------------------
  // internals
  // -------------------------------------------------------------------------

  /** Fields whose modification can change what a submission scores. */
  private touchesJudging(dto: UpsertChallengeDto): boolean {
    return (
      dto.functionContract !== undefined ||
      dto.judgeMethod !== undefined ||
      dto.referenceSolutionCode !== undefined ||
      dto.customCheckerCode !== undefined ||
      dto.testGeneratorCode !== undefined ||
      dto.timeLimitMs !== undefined ||
      dto.memoryLimitMb !== undefined ||
      dto.outputLimitKb !== undefined ||
      dto.problemType !== undefined ||
      dto.testCases !== undefined
    );
  }

  private assertContract(contract: {
    functionName: string;
    parameters: { name: string; type: string }[];
    returnType: string;
  }) {
    const errors = validateFunctionContract(
      contract as unknown as {
        functionName: string;
        parameters: FunctionParameter[];
        returnType: string;
      },
    );
    if (errors.length) {
      throw new InvalidFunctionContractException(errors.join(' '));
    }
  }

  /**
   * Explicit field-by-field mapping of untrusted JSON into rows. Never
   * `prisma.create({ data: whateverCameIn })`.
   */
  private normalizeTestCases(
    testCases: TestCaseDto[],
    parameters: FunctionParameter[],
  ): NormalizedTestCase[] {
    return testCases.map((testCase, index) => {
      let input: unknown;
      let expectedOutput: unknown;
      try {
        input = sanitizeJsonValue(testCase.input);
        expectedOutput =
          testCase.expectedOutput === undefined || testCase.expectedOutput === null
            ? null
            : sanitizeJsonValue(testCase.expectedOutput);
      } catch (error) {
        throw new InvalidTestCaseException(
          `Test case #${index + 1}: ${(error as Error).message}`,
        );
      }

      const serialized = JSON.stringify({ input, expectedOutput });
      if (Buffer.byteLength(serialized, 'utf8') > MAX_TEST_CASE_JSON_BYTES) {
        throw new InvalidTestCaseException(
          `Test case #${index + 1} is larger than ${MAX_TEST_CASE_JSON_BYTES} bytes.`,
        );
      }

      if (parameters.length) {
        const errors = validateTestCaseInput(input, parameters);
        if (errors.length) {
          throw new InvalidTestCaseException(
            `Test case #${index + 1}: ${errors.join(' ')}`,
          );
        }
      }

      return {
        input: input as Prisma.InputJsonValue,
        expectedOutput:
          expectedOutput === null || expectedOutput === undefined
            ? Prisma.DbNull
            : (expectedOutput as Prisma.InputJsonValue),
        isHidden: testCase.isHidden ?? true,
        order: index,
      };
    });
  }

  /**
   * Returns a free slug. An explicitly supplied slug that is taken is an error;
   * one derived from the title gets a numeric suffix instead so "Save Draft"
   * never fails on a title collision.
   */
  private async resolveSlug(
    candidate: string,
    excludeId: string | null,
    explicit = false,
  ): Promise<string> {
    const base = slugify(candidate) || 'challenge';
    const taken = async (slug: string) => {
      const found = await this.prisma.challenge.findUnique({
        where: { slug },
        select: { id: true },
      });
      return !!found && found.id !== excludeId;
    };

    if (!(await taken(base))) return base;
    if (explicit) throw new ChallengeSlugExistsException();

    for (let suffix = 2; suffix < 200; suffix++) {
      const next = `${base.slice(0, SLUG_MAX_LENGTH - 5)}-${suffix}`;
      if (!(await taken(next))) return next;
    }
    throw new ChallengeSlugExistsException();
  }

  /** Upserts tags by slug and returns a Prisma connect clause. */
  private async tagConnector(labels?: string[]) {
    if (!labels?.length) return undefined;

    const unique = new Map<string, string>();
    for (const label of labels) {
      const trimmed = label.trim();
      if (!trimmed) continue;
      const slug = slugify(trimmed);
      if (slug) unique.set(slug, trimmed);
    }
    if (!unique.size) return undefined;

    const tags = await Promise.all(
      [...unique.entries()].map(([slug, label]) =>
        this.prisma.challengeTag.upsert({
          where: { slug },
          update: {},
          create: { slug, label },
        }),
      ),
    );

    return { connect: tags.map((tag) => ({ id: tag.id })) };
  }
}
