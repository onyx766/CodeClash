import {
  computeChallengeFingerprint,
  FingerprintInput,
} from './challenge-fingerprint.util';

const base: FingerprintInput = {
  problemType: 'FUNCTION',
  functionName: 'solve',
  parameters: [
    { name: 'nums', type: 'number[]' },
    { name: 'target', type: 'number' },
  ],
  returnType: 'number[]',
  starterCode: 'function solve(nums, target) {}',
  judgeMethod: 'DEEP_EQUAL',
  referenceSolutionCode: null,
  customCheckerCode: null,
  testGeneratorCode: null,
  timeLimitMs: 2000,
  memoryLimitMb: 128,
  outputLimitKb: 64,
  testCases: [
    { order: 0, isHidden: false, input: { nums: [2, 7], target: 9 }, expectedOutput: [0, 1] },
    { order: 1, isHidden: true, input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1] },
  ],
};

describe('computeChallengeFingerprint', () => {
  it('is stable for identical input', () => {
    expect(computeChallengeFingerprint(base)).toBe(
      computeChallengeFingerprint({ ...base }),
    );
  });

  it('ignores object key order inside test data', () => {
    const reordered: FingerprintInput = {
      ...base,
      testCases: [
        {
          order: 0,
          isHidden: false,
          input: { target: 9, nums: [2, 7] },
          expectedOutput: [0, 1],
        },
        base.testCases[1],
      ],
    };
    expect(computeChallengeFingerprint(reordered)).toBe(
      computeChallengeFingerprint(base),
    );
  });

  it('ignores the order test cases arrive in', () => {
    const swapped: FingerprintInput = {
      ...base,
      testCases: [base.testCases[1], base.testCases[0]],
    };
    expect(computeChallengeFingerprint(swapped)).toBe(
      computeChallengeFingerprint(base),
    );
  });

  it('changes when a hidden expectation is edited', () => {
    const edited: FingerprintInput = {
      ...base,
      testCases: [base.testCases[0], { ...base.testCases[1], expectedOutput: [1, 0] }],
    };
    expect(computeChallengeFingerprint(edited)).not.toBe(
      computeChallengeFingerprint(base),
    );
  });

  it('changes when judging configuration or limits move', () => {
    for (const mutation of [
      { judgeMethod: 'EXACT' },
      { timeLimitMs: 3000 },
      { memoryLimitMb: 256 },
      { outputLimitKb: 128 },
      { referenceSolutionCode: 'function solve() {}' },
      { customCheckerCode: 'function check() {}' },
      { testGeneratorCode: 'function generate() {}' },
      { starterCode: 'function solve(a, b) {}' },
      { functionName: 'answer' },
      { returnType: 'number' },
    ] as Partial<FingerprintInput>[]) {
      expect(computeChallengeFingerprint({ ...base, ...mutation })).not.toBe(
        computeChallengeFingerprint(base),
      );
    }
  });

  it('is unaffected by presentational fields, which are not part of the input', () => {
    // title/slug/description/tags are deliberately absent from FingerprintInput,
    // so fixing a typo in a problem statement never forces a re-validation.
    expect(Object.keys(base)).not.toContain('title');
    expect(Object.keys(base)).not.toContain('description');
  });
});
