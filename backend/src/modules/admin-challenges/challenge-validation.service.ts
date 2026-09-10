import { Injectable, Logger } from '@nestjs/common';
import {
  ChallengeProblemType,
  ChallengeValidationStatus,
  JudgeMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { JudgeRunnerClient } from '../runner/judge-runner.client';
import { ChallengeValidationFailedException } from '../../common/exceptions/app.exception';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  MEMORY_LIMIT_MB_MAX,
  MEMORY_LIMIT_MB_MIN,
  MIN_HIDDEN_TESTS,
  MIN_PUBLIC_TESTS,
  OUTPUT_LIMIT_KB_MAX,
  OUTPUT_LIMIT_KB_MIN,
  TIME_LIMIT_MS_MAX,
  TIME_LIMIT_MS_MIN,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '../challenges/challenge.constants';
import {
  isValidSlug,
  validateFunctionContract,
  validateTestCaseInput,
} from '../challenges/function-contract.util';
import type {
  FunctionParameter,
  JsonValue,
  RunnerJobPayload,
  RunnerTestCase,
  ValidationCheck,
} from '../challenges/challenge.types';
import type { ChallengeWithRelations } from './challenge.serializer';
import { AdminChallengesService } from './admin-challenges.service';

/** Fixed seeds so a generator check is reproducible run to run. */
const VALIDATION_GENERATOR_SEEDS = [101, 202, 303];

@Injectable()
export class ChallengeValidationService {
  private readonly logger = new Logger(ChallengeValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: JudgeRunnerClient,
    private readonly challenges: AdminChallengesService,
  ) {}

  /**
   * Server-side validation of a challenge.
   *
   * Static checks (schema, contract, limits, judge configuration, test counts)
   * run here because they are pure string/shape checks. Everything that needs
   * code to actually execute - starter code parsing, the reference solution,
   * the custom checker, the generator, and running the fixed tests - is handed
   * to the isolated runner as a CHALLENGE_VALIDATION job. NestJS never
   * evaluates any of that code itself.
   */
  async validate(challengeId: string) {
    const challenge = await this.challenges.loadOrThrow(challengeId);

    const checks: ValidationCheck[] = this.staticChecks(challenge);
    const staticFailed = checks.some((check) => !check.passed);

    if (!staticFailed) {
      const payload = this.buildRunnerJob(challenge);
      const result = await this.runner.trySubmit(payload);

      if (!result.ok) {
        // The runner being unreachable is not the same as the challenge being
        // wrong, so nothing is recorded as FAILED here.
        const message = result.error
          ? String(result.error)
          : 'The code runner did not return a result.';
        this.logger.warn(
          `Validation of challenge ${challengeId} could not run: ${message}`,
        );
        throw new ChallengeValidationFailedException(
          `The code runner could not be reached, so this challenge was not validated. (${message})`,
        );
      }

      checks.push(...(result.checks ?? []));
    }

    const publishProblems = this.challenges.publishReadiness(challenge);
    const allPassed =
      checks.every((check) => check.passed) && publishProblems.length === 0;

    checks.push({
      name: 'READY_TO_PUBLISH',
      passed: allPassed,
      message: allPassed
        ? 'No issues found.'
        : publishProblems.length
          ? publishProblems.join(' ')
          : 'Resolve the failing checks above.',
    });

    const status = allPassed
      ? ChallengeValidationStatus.PASSED
      : ChallengeValidationStatus.FAILED;
    const validatedAt = new Date();

    await this.prisma.challenge.update({
      where: { id: challengeId },
      data: {
        validationStatus: status,
        validatedAt,
        validationChecks: checks as unknown as Prisma.InputJsonValue,
        // Only a passing run records a fingerprint; publish() compares against
        // it, so a FAILED run can never leave a publishable state behind.
        validationFingerprint: allPassed
          ? this.challenges.fingerprint(challenge)
          : null,
      },
    });

    return {
      validation: {
        status,
        validatedAt,
        checks,
      },
    };
  }

  // -------------------------------------------------------------------------

  /** Checks that need no code execution. */
  private staticChecks(challenge: ChallengeWithRelations): ValidationCheck[] {
    const checks: ValidationCheck[] = [];
    const parameters = (challenge.parameters as unknown as FunctionParameter[]) ?? [];

    // 1. schema
    const schemaProblems: string[] = [];
    if (
      challenge.title.length < TITLE_MIN_LENGTH ||
      challenge.title.length > TITLE_MAX_LENGTH
    ) {
      schemaProblems.push(
        `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
      );
    }
    if (!isValidSlug(challenge.slug)) {
      schemaProblems.push('Slug must be lowercase letters, numbers and hyphens.');
    }
    if (
      challenge.description.trim().length < DESCRIPTION_MIN_LENGTH ||
      challenge.description.length > DESCRIPTION_MAX_LENGTH
    ) {
      schemaProblems.push(
        `Description must be between ${DESCRIPTION_MIN_LENGTH} and ${DESCRIPTION_MAX_LENGTH} characters.`,
      );
    }
    if (challenge.problemType !== ChallengeProblemType.FUNCTION) {
      schemaProblems.push('Only FUNCTION challenges can be validated for now.');
    }
    checks.push({
      name: 'CHALLENGE_SCHEMA',
      passed: schemaProblems.length === 0,
      message: schemaProblems.join(' ') || null,
    });

    // 2. function contract
    const contractProblems = validateFunctionContract({
      functionName: challenge.functionName,
      parameters,
      returnType: challenge.returnType,
    });
    if (!challenge.starterCode.trim()) {
      contractProblems.push('Starter code is required.');
    }
    checks.push({
      name: 'FUNCTION_CONTRACT',
      passed: contractProblems.length === 0,
      message: contractProblems.join(' ') || 'Matches expected format.',
    });

    // 3. execution limits
    const limitProblems: string[] = [];
    if (
      challenge.timeLimitMs < TIME_LIMIT_MS_MIN ||
      challenge.timeLimitMs > TIME_LIMIT_MS_MAX
    ) {
      limitProblems.push(
        `Time limit must be between ${TIME_LIMIT_MS_MIN} and ${TIME_LIMIT_MS_MAX} ms.`,
      );
    }
    if (
      challenge.memoryLimitMb < MEMORY_LIMIT_MB_MIN ||
      challenge.memoryLimitMb > MEMORY_LIMIT_MB_MAX
    ) {
      limitProblems.push(
        `Memory limit must be between ${MEMORY_LIMIT_MB_MIN} and ${MEMORY_LIMIT_MB_MAX} MB.`,
      );
    }
    if (
      challenge.outputLimitKb < OUTPUT_LIMIT_KB_MIN ||
      challenge.outputLimitKb > OUTPUT_LIMIT_KB_MAX
    ) {
      limitProblems.push(
        `Output limit must be between ${OUTPUT_LIMIT_KB_MIN} and ${OUTPUT_LIMIT_KB_MAX} KB.`,
      );
    }
    checks.push({
      name: 'EXECUTION_LIMITS',
      passed: limitProblems.length === 0,
      message: limitProblems.join(' ') || null,
    });

    // 4. judge configuration
    const judgeProblems: string[] = [];
    if (
      challenge.judgeMethod === JudgeMethod.CUSTOM_CHECKER &&
      !challenge.customCheckerCode?.trim()
    ) {
      judgeProblems.push('The CUSTOM_CHECKER judge method requires checker code.');
    }
    if (
      challenge.judgeMethod === JudgeMethod.REFERENCE &&
      !challenge.referenceSolutionCode?.trim()
    ) {
      judgeProblems.push('The REFERENCE judge method requires a reference solution.');
    }
    checks.push({
      name: 'JUDGE_CONFIGURATION',
      passed: judgeProblems.length === 0,
      message: judgeProblems.join(' ') || null,
    });

    // 5. test counts and per-test shape
    const publicTests = challenge.testCases.filter((t) => !t.isHidden);
    const hiddenTests = challenge.testCases.filter((t) => t.isHidden);
    const testProblems: string[] = [];

    if (publicTests.length < MIN_PUBLIC_TESTS) {
      testProblems.push(`At least ${MIN_PUBLIC_TESTS} public test case is required.`);
    }
    if (hiddenTests.length < MIN_HIDDEN_TESTS) {
      testProblems.push(`At least ${MIN_HIDDEN_TESTS} hidden test cases are required.`);
    }

    const needsExpectation =
      challenge.judgeMethod !== JudgeMethod.CUSTOM_CHECKER &&
      !challenge.referenceSolutionCode?.trim();

    for (const testCase of challenge.testCases) {
      if (parameters.length) {
        const inputProblems = validateTestCaseInput(testCase.input, parameters);
        if (inputProblems.length) {
          testProblems.push(`Test #${testCase.order + 1}: ${inputProblems.join(' ')}`);
        }
      }
      if (
        needsExpectation &&
        (testCase.expectedOutput === null || testCase.expectedOutput === undefined)
      ) {
        testProblems.push(
          `Test #${testCase.order + 1} has no expected output, and there is no reference solution to derive one.`,
        );
      }
    }

    checks.push({
      name: 'TEST_COUNTS',
      passed: testProblems.length === 0,
      passedCount: publicTests.length + hiddenTests.length,
      totalCount: challenge.testCases.length,
      message:
        testProblems.slice(0, 5).join(' ') ||
        `${publicTests.length} public and ${hiddenTests.length} hidden test cases.`,
    });

    return checks;
  }

  /** Builds the CHALLENGE_VALIDATION job for the runner. */
  private buildRunnerJob(challenge: ChallengeWithRelations): RunnerJobPayload {
    const tests: RunnerTestCase[] = challenge.testCases.map((testCase) => ({
      id: testCase.id,
      input: testCase.input as JsonValue,
      expectedOutput:
        testCase.expectedOutput === null
          ? undefined
          : (testCase.expectedOutput as JsonValue),
      hidden: testCase.isHidden,
      order: testCase.order,
    }));

    return {
      jobType: 'CHALLENGE_VALIDATION',
      challengeId: challenge.id,
      language: 'javascript',
      functionContract: {
        functionName: challenge.functionName,
        parameters: (challenge.parameters as unknown as FunctionParameter[]) ?? [],
        returnType: challenge.returnType,
      },
      judgeMethod: challenge.judgeMethod,
      starterCode: challenge.starterCode,
      referenceSolutionCode: challenge.referenceSolutionCode,
      customCheckerCode: challenge.customCheckerCode,
      generatorCode: challenge.testGeneratorCode,
      limits: {
        timeLimitMs: challenge.timeLimitMs,
        memoryLimitMb: challenge.memoryLimitMb,
        outputLimitKb: challenge.outputLimitKb,
      },
      tests,
      generatorSeeds: challenge.testGeneratorCode
        ? VALIDATION_GENERATOR_SEEDS
        : undefined,
      metadata: { challengeId: challenge.id, kind: 'admin-validation' },
    };
  }
}
