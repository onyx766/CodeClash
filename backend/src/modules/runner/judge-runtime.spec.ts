import { execFileSync } from 'child_process';
import { mkdtempSync, copyFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type {
  RunnerJobPayload,
  RunnerJobResult,
} from '../challenges/challenge.types';

/**
 * Executes the real judge runtime that ships with the code runner.
 *
 * In production this file runs inside a locked-down container (see
 * code-runner/worker). Here it is invoked directly with `node`, which is enough
 * to prove the judging semantics themselves - which verdict each judge method
 * produces, and that a broken solution is classified correctly.
 *
 * The point of these tests is that this logic lives in the runner and nowhere
 * else: nothing in the NestJS process ever evaluates challenge or player code.
 */
const RUNTIME = resolve(
  __dirname,
  '../../../../code-runner/src/executor/judge-runtime.js',
);

const CONTRACT = {
  functionName: 'solve',
  parameters: [
    { name: 'nums', type: 'number[]' as const },
    { name: 'target', type: 'number' as const },
  ],
  returnType: 'number[]' as const,
};

const TWO_SUM =
  'function solve(nums, target) {\n' +
  '  const seen = new Map();\n' +
  '  for (let i = 0; i < nums.length; i++) {\n' +
  '    const complement = target - nums[i];\n' +
  '    if (seen.has(complement)) return [seen.get(complement), i];\n' +
  '    seen.set(nums[i], i);\n' +
  '  }\n' +
  '  return [];\n' +
  '}';

function runJob(job: Partial<RunnerJobPayload> & { jobId?: string }): RunnerJobResult {
  const dir = mkdtempSync(join(tmpdir(), 'codeclash-judge-'));
  try {
    copyFileSync(RUNTIME, join(dir, 'judge-runtime.js'));
    writeFileSync(
      join(dir, 'job.json'),
      JSON.stringify({
        jobId: 'test-job',
        language: 'javascript',
        limits: { timeLimitMs: 1000, memoryLimitMb: 128, outputLimitKb: 64 },
        ...job,
      }),
    );
    const stdout = execFileSync(process.execPath, ['judge-runtime.js'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 30_000,
    });
    const line = stdout.trim().split(/\r?\n/).pop()!;
    return JSON.parse(line) as RunnerJobResult;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const submission = (
  sourceCode: string,
  tests: RunnerJobPayload['tests'],
  overrides: Partial<RunnerJobPayload> = {},
) =>
  runJob({
    jobType: 'SUBMISSION',
    challengeId: 'challenge-1',
    sourceCode,
    functionContract: CONTRACT,
    judgeMethod: 'DEEP_EQUAL',
    tests,
    ...overrides,
  });

const statusOf = (result: RunnerJobResult, index = 0) =>
  result.tests?.[index]?.status;

describe('code runner judge runtime', () => {
  it('ships with the code runner', () => {
    expect(existsSync(RUNTIME)).toBe(true);
  });

  describe('sandbox isolation', () => {
    // A verdict a submission might try to print in place of the runtime's own.
    const FORGED = JSON.stringify({ ok: true, tests: [], passedTests: 1, totalTests: 1, runtimeMs: 1 });
    const oneTest = [
      { id: 't1', input: { nums: [1], target: 1 }, expectedOutput: [0, 0], hidden: true, order: 0 },
    ];

    it.each([
      ['module', 'module.constructor.constructor'],
      ['exports', 'exports.constructor.constructor'],
      ['console.log', 'console.log.constructor'],
      ['the global object', 'this.constructor.constructor'],
    ])('cannot reach the host process through %s to forge a verdict', (_label, route) => {
      const source =
        `const p = ${route}('return process')();\n` +
        `p.stdout.write(${JSON.stringify(FORGED)} + '\\n');\n` +
        'p.exit(0);';
      const result = submission(source, oneTest);

      // The last line is still the runtime's own verdict, not the forgery.
      expect(result.jobId).toBe('test-job');
      expect(result.passedTests).toBe(0);
      expect(statusOf(result)).toBe('RUNTIME_ERROR');
    });

    it('cannot read the job file, which holds hidden expectations', () => {
      const source =
        'function solve() {\n' +
        "  const p = this.constructor.constructor('return process')();\n" +
        "  return JSON.parse(p.mainModule.require('fs').readFileSync('./job.json', 'utf8')).tests[0].expectedOutput;\n" +
        '}';
      const result = submission(source, oneTest);

      expect(result.passedTests).toBe(0);
      expect(statusOf(result)).toBe('RUNTIME_ERROR');
      // Diagnostics for hidden tests are never echoed back.
      expect(result.tests?.[0]?.message ?? null).toBeNull();
    });

    it('sees no Node.js globals', () => {
      const probe =
        'function solve() {\n' +
        "  return [typeof process, typeof require, typeof Buffer].join(',');\n" +
        '}';
      const result = submission(probe, [
        {
          id: 't1',
          input: { nums: [], target: 0 },
          expectedOutput: 'undefined,undefined,undefined',
          hidden: false,
          order: 0,
        },
      ]);

      expect(statusOf(result)).toBe('PASSED');
    });
  });

  describe('function calling convention', () => {
    it('maps a test input object onto positional arguments in contract order', () => {
      const result = submission(TWO_SUM, [
        {
          id: 't1',
          input: { nums: [2, 7, 11, 15], target: 9 },
          expectedOutput: [0, 1],
          hidden: false,
          order: 0,
        },
        // Deliberately written with the keys in the other order: the contract,
        // not the JSON key order, decides the argument list.
        {
          id: 't2',
          input: { target: 6, nums: [3, 2, 4] },
          expectedOutput: [1, 2],
          hidden: true,
          order: 1,
        },
      ]);

      expect(result.passedTests).toBe(2);
      expect(result.totalTests).toBe(2);
    });
  });

  describe('judge methods', () => {
    const test = (expectedOutput: unknown) => [
      {
        id: 't1',
        input: { nums: [1], target: 1 },
        expectedOutput,
        hidden: false,
        order: 0,
      },
    ];

    it('EXACT is strict and type-aware', () => {
      const numeric = 'function solve() { return 42; }';
      expect(
        statusOf(submission(numeric, test(42) as never, { judgeMethod: 'EXACT' })),
      ).toBe('PASSED');
      // "42" must not equal 42 - no String() coercion.
      expect(
        statusOf(submission(numeric, test('42') as never, { judgeMethod: 'EXACT' })),
      ).toBe('WRONG_ANSWER');
      expect(
        statusOf(
          submission('function solve() { return true; }', test(true) as never, {
            judgeMethod: 'EXACT',
          }),
        ),
      ).toBe('PASSED');
    });

    it('EXACT refuses to compare structures', () => {
      const result = submission(
        'function solve() { return [0, 1]; }',
        test([0, 1]) as never,
        { judgeMethod: 'EXACT' },
      );
      expect(statusOf(result)).toBe('WRONG_ANSWER');
      expect(result.tests?.[0].message).toMatch(/primitive values only/);
    });

    it('DEEP_EQUAL ignores object key order but not array order', () => {
      expect(
        statusOf(
          submission(
            'function solve() { return { count: 5, result: true }; }',
            test({ result: true, count: 5 }) as never,
          ),
        ),
      ).toBe('PASSED');

      expect(
        statusOf(
          submission('function solve() { return [1, 0]; }', test([0, 1]) as never),
        ),
      ).toBe('WRONG_ANSWER');
    });

    it('DEEP_EQUAL is type-strict inside structures', () => {
      expect(
        statusOf(
          submission('function solve() { return ["1"]; }', test([1]) as never),
        ),
      ).toBe('WRONG_ANSWER');
    });

    it('CUSTOM_CHECKER accepts any answer the checker approves', () => {
      const checker =
        'function check(input, actual, expected) {\n' +
        '  if (!Array.isArray(actual) || actual.length !== 2) {\n' +
        "    return { passed: false, message: 'Expected two indices.' };\n" +
        '  }\n' +
        '  const [i, j] = actual;\n' +
        '  const ok = i !== j && input.nums[i] + input.nums[j] === input.target;\n' +
        "  return { passed: ok, message: ok ? null : 'Indices do not add up to target.' };\n" +
        '}';
      const tests = [
        {
          id: 't1',
          input: { nums: [2, 7, 11, 15], target: 9 },
          expectedOutput: [0, 1],
          hidden: false,
          order: 0,
        },
      ];

      // [1,0] is not the stored expectation but is still a correct answer.
      expect(
        statusOf(
          submission('function solve() { return [1, 0]; }', tests as never, {
            judgeMethod: 'CUSTOM_CHECKER',
            customCheckerCode: checker,
          }),
        ),
      ).toBe('PASSED');

      const wrong = submission(
        'function solve() { return [0, 3]; }',
        tests as never,
        { judgeMethod: 'CUSTOM_CHECKER', customCheckerCode: checker },
      );
      expect(statusOf(wrong)).toBe('WRONG_ANSWER');
      expect(wrong.tests?.[0].message).toMatch(/do not add up/);
    });

    it('CUSTOM_CHECKER rejects a checker that returns the wrong shape', () => {
      const result = submission(
        'function solve() { return [0, 1]; }',
        test([0, 1]) as never,
        {
          judgeMethod: 'CUSTOM_CHECKER',
          customCheckerCode: 'function check() { return "yes"; }',
        },
      );
      expect(statusOf(result)).toBe('SYSTEM_ERROR');
      expect(result.tests?.[0].message).toMatch(/must return \{ passed/);
    });

    it('REFERENCE derives the expected value from the reference solution', () => {
      const tests = [
        {
          id: 't1',
          input: { nums: [2, 7, 11, 15], target: 9 },
          // No stored expectation at all.
          hidden: true,
          order: 0,
        },
      ];

      expect(
        statusOf(
          submission(TWO_SUM, tests as never, {
            judgeMethod: 'REFERENCE',
            referenceSolutionCode: TWO_SUM,
          }),
        ),
      ).toBe('PASSED');

      expect(
        statusOf(
          submission('function solve() { return []; }', tests as never, {
            judgeMethod: 'REFERENCE',
            referenceSolutionCode: TWO_SUM,
          }),
        ),
      ).toBe('WRONG_ANSWER');
    });
  });

  describe('execution result statuses', () => {
    const test = [
      { id: 't1', input: { nums: [1], target: 1 }, expectedOutput: [0], hidden: false, order: 0 },
    ];

    it('reports TIME_LIMIT for a solution that never returns', () => {
      expect(
        statusOf(
          submission('function solve() { while (true) {} }', test as never, {
            limits: { timeLimitMs: 300, memoryLimitMb: 128, outputLimitKb: 64 },
          }),
        ),
      ).toBe('TIME_LIMIT');
    });

    it('reports RUNTIME_ERROR for a thrown error', () => {
      const result = submission(
        'function solve() { throw new Error("boom"); }',
        test as never,
      );
      expect(statusOf(result)).toBe('RUNTIME_ERROR');
      expect(result.tests?.[0].message).toMatch(/boom/);
    });

    it('reports RUNTIME_ERROR for code that does not parse', () => {
      expect(statusOf(submission('function solve( {', test as never))).toBe(
        'RUNTIME_ERROR',
      );
    });

    it('reports RUNTIME_ERROR when the required function is missing', () => {
      const result = submission('const x = 1;', test as never);
      expect(statusOf(result)).toBe('RUNTIME_ERROR');
      expect(result.tests?.[0].message).toMatch(/No function named "solve"/);
    });

    it('reports OUTPUT_LIMIT for an oversized return value', () => {
      expect(
        statusOf(
          submission('function solve() { return "x".repeat(5000); }', test as never, {
            limits: { timeLimitMs: 1000, memoryLimitMb: 128, outputLimitKb: 1 },
          }),
        ),
      ).toBe('OUTPUT_LIMIT');
    });

    it('rejects an asynchronous solution rather than silently passing', () => {
      const result = submission('async function solve() { return [0]; }', test as never);
      expect(statusOf(result)).toBe('RUNTIME_ERROR');
      expect(result.tests?.[0].message).toMatch(/Asynchronous/);
    });

    it('gives the sandbox no access to the host', () => {
      for (const probe of [
        'function solve() { return typeof require; }',
        'function solve() { return typeof process; }',
        'function solve() { return typeof globalThis.fetch; }',
      ]) {
        const result = submission(probe, [
          {
            id: 't1',
            input: { nums: [1], target: 1 },
            expectedOutput: 'undefined',
            hidden: false,
            order: 0,
          },
        ] as never);
        expect(statusOf(result)).toBe('PASSED');
      }
    });

    it('does not let one test mutate the input of another', () => {
      const mutating =
        'function solve(nums, target) { nums.push(999); return [nums.length]; }';
      const result = submission(mutating, [
        { id: 't1', input: { nums: [1], target: 1 }, expectedOutput: [2], hidden: false, order: 0 },
        { id: 't2', input: { nums: [1], target: 1 }, expectedOutput: [2], hidden: true, order: 1 },
      ] as never);
      expect(result.passedTests).toBe(2);
    });
  });

  describe('challenge validation jobs', () => {
    const tests = [
      { id: 't1', input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], hidden: false, order: 0 },
      { id: 't2', input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], hidden: true, order: 1 },
      { id: 't3', input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], hidden: true, order: 2 },
    ];

    const validate = (overrides: Partial<RunnerJobPayload> = {}) =>
      runJob({
        jobType: 'CHALLENGE_VALIDATION',
        challengeId: 'challenge-1',
        functionContract: CONTRACT,
        judgeMethod: 'DEEP_EQUAL',
        starterCode: 'function solve(nums, target) {\n  // Write your solution here\n}',
        tests,
        ...overrides,
      });

    const check = (result: RunnerJobResult, name: string) =>
      result.checks?.find((c) => c.name === name);

    it('passes every check for a correct challenge', () => {
      const result = validate({ referenceSolutionCode: TWO_SUM });

      expect(check(result, 'STARTER_CODE')?.passed).toBe(true);
      expect(check(result, 'REFERENCE_SOLUTION')?.passed).toBe(true);
      expect(check(result, 'PUBLIC_TESTS')).toMatchObject({
        passed: true,
        passedCount: 1,
        totalCount: 1,
      });
      expect(check(result, 'HIDDEN_TESTS')).toMatchObject({
        passed: true,
        passedCount: 2,
        totalCount: 2,
      });
    });

    it('catches an expected output the reference solution disagrees with', () => {
      const wrongTests = [
        tests[0],
        { ...tests[1], expectedOutput: [9, 9] },
        tests[2],
      ];
      const result = validate({ referenceSolutionCode: TWO_SUM, tests: wrongTests as never });

      const hidden = check(result, 'HIDDEN_TESTS')!;
      expect(hidden.passed).toBe(false);
      expect(hidden.message).toMatch(/Reference solution failed test #2/);
      expect(hidden.failures?.[0]).toMatchObject({
        order: 1,
        status: 'WRONG_ANSWER',
        expectedOutput: [9, 9],
        actualOutput: [1, 2],
      });
    });

    it('reports a starter code syntax error', () => {
      const result = validate({ starterCode: 'function solve( {' });
      expect(check(result, 'STARTER_CODE')?.passed).toBe(false);
      expect(check(result, 'STARTER_CODE')?.message).toMatch(/SyntaxError/);
    });

    it('reports a broken reference solution', () => {
      const result = validate({ referenceSolutionCode: 'function solve( {' });
      expect(check(result, 'REFERENCE_SOLUTION')?.passed).toBe(false);
    });

    it('skips test execution when no reference solution is configured', () => {
      const result = validate();
      expect(check(result, 'PUBLIC_TESTS')).toMatchObject({
        passed: true,
        skipped: true,
      });
      expect(check(result, 'PUBLIC_TESTS')?.message).toMatch(/no reference solution/);
    });

    it('requires checker code for the CUSTOM_CHECKER method', () => {
      const result = validate({ judgeMethod: 'CUSTOM_CHECKER' });
      expect(check(result, 'CUSTOM_CHECKER')?.passed).toBe(false);
    });

    it('requires a reference solution for the REFERENCE method', () => {
      const result = validate({ judgeMethod: 'REFERENCE' });
      expect(check(result, 'REFERENCE_SOLUTION')?.passed).toBe(false);
    });

    it('accepts a seeded generator and confirms it is reproducible', () => {
      const generator =
        'function generate(seed) {\n' +
        '  let s = seed >>> 0;\n' +
        '  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;\n' +
        '  const nums = [Math.floor(rand() * 50), Math.floor(rand() * 50)];\n' +
        '  return { nums, target: nums[0] + nums[1] };\n' +
        '}';
      const result = validate({
        referenceSolutionCode: TWO_SUM,
        generatorCode: generator,
        generatorSeeds: [1, 2, 3],
      });

      expect(check(result, 'GENERATOR')?.passed).toBe(true);
      expect(check(result, 'GENERATOR_DETERMINISM')?.passed).toBe(true);
    });

    it('rejects a generator that uses unseeded randomness', () => {
      const result = validate({
        referenceSolutionCode: TWO_SUM,
        generatorCode:
          'function generate(seed) { const n = Math.floor(Math.random() * 50); return { nums: [n, n], target: n * 2 }; }',
        generatorSeeds: [1, 2],
      });

      expect(check(result, 'GENERATOR_DETERMINISM')?.passed).toBe(false);
      expect(check(result, 'GENERATOR_DETERMINISM')?.message).toMatch(
        /Math\.random/,
      );
    });

    it('rejects a generator that omits a declared parameter', () => {
      const result = validate({
        referenceSolutionCode: TWO_SUM,
        generatorCode: 'function generate(seed) { return { nums: [1, 2] }; }',
        generatorSeeds: [1],
      });

      expect(check(result, 'GENERATOR')?.passed).toBe(false);
      expect(check(result, 'GENERATOR')?.message).toMatch(/"target"/);
    });
  });
});
