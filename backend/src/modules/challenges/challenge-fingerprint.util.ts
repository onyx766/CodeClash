import { createHash } from 'crypto';

/**
 * Judging fingerprint.
 *
 * Everything that can change what a submission scores goes in here: the
 * function contract, the judge method, the executable challenge code, the
 * execution limits and every test case. Presentational fields (title, tags,
 * description, slug) deliberately do not, so fixing a typo in a problem
 * statement does not force a re-validation.
 *
 * ChallengeValidationService stores this when validation passes and
 * AdminChallengesService.publish recomputes and compares it. That makes the
 * database the authority on "is this validation still current" - a
 * validate -> edit a hidden test -> publish sequence fails even if some future
 * update path forgets to reset validationStatus.
 */

export interface FingerprintInput {
  problemType: string;
  functionName: string;
  parameters: unknown;
  returnType: string;
  starterCode: string;
  judgeMethod: string;
  referenceSolutionCode: string | null;
  customCheckerCode: string | null;
  testGeneratorCode: string | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  outputLimitKb: number;
  testCases: {
    order: number;
    isHidden: boolean;
    input: unknown;
    expectedOutput: unknown;
  }[];
}

/** JSON.stringify with object keys sorted, so key order never shifts the hash. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
  return `{${entries.join(',')}}`;
}

export function computeChallengeFingerprint(input: FingerprintInput): string {
  const canonical = {
    problemType: input.problemType,
    functionName: input.functionName,
    parameters: input.parameters ?? [],
    returnType: input.returnType,
    starterCode: input.starterCode,
    judgeMethod: input.judgeMethod,
    referenceSolutionCode: input.referenceSolutionCode ?? null,
    customCheckerCode: input.customCheckerCode ?? null,
    testGeneratorCode: input.testGeneratorCode ?? null,
    limits: {
      timeLimitMs: input.timeLimitMs,
      memoryLimitMb: input.memoryLimitMb,
      outputLimitKb: input.outputLimitKb,
    },
    testCases: [...input.testCases]
      .sort((a, b) => a.order - b.order)
      .map((testCase) => ({
        order: testCase.order,
        isHidden: testCase.isHidden,
        input: testCase.input ?? null,
        expectedOutput: testCase.expectedOutput ?? null,
      })),
  };

  return createHash('sha256').update(stableStringify(canonical)).digest('hex');
}

/**
 * Fields whose modification invalidates a passed validation. Kept next to the
 * fingerprint so the two lists cannot drift apart.
 */
export const JUDGING_RELEVANT_FIELDS = [
  'problemType',
  'functionName',
  'parameters',
  'returnType',
  'starterCode',
  'judgeMethod',
  'referenceSolutionCode',
  'customCheckerCode',
  'testGeneratorCode',
  'timeLimitMs',
  'memoryLimitMb',
  'outputLimitKb',
  'testCases',
] as const;
