import * as argon2 from 'argon2';
import { Difficulty, JudgeMethod, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('password123', {
    type: argon2.argon2id,
  });

  const master = await prisma.user.upsert({
    where: { email: 'master@codeclash.local' },
    update: {},
    create: {
      email: 'master@codeclash.local',
      username: 'master',
      passwordHash,
      role: 'MASTER',
      profile: { create: {} },
      stats: { create: { rating: 1800 } },
      preferences: { create: {} },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@codeclash.local' },
    update: {},
    create: {
      email: 'admin@codeclash.local',
      username: 'admin',
      passwordHash,
      role: 'ADMIN',
      profile: { create: {} },
      stats: { create: { rating: 1500 } },
      preferences: { create: {} },
    },
  });

  for (let i = 1; i <= 5; i++) {
    await prisma.user.upsert({
      where: { email: `player${i}@codeclash.local` },
      update: {},
      create: {
        email: `player${i}@codeclash.local`,
        username: `player${i}`,
        passwordHash,
        role: 'USER',
        profile: { create: {} },
        stats: { create: {} },
        preferences: { create: {} },
      },
    });
  }

  // A match plays totalRounds (3) distinct challenges, so the published pool
  // must hold at least that many - otherwise startQuickMatch cancels the match
  // with ChallengePoolInsufficientException. Keep this list at 3 or more.
  //
  // timeLimitSeconds is the ROUND duration: how long players get to write a
  // solution, and what Round.endsAt is derived from. It is NOT an execution
  // limit - those are timeLimitMs / memoryLimitMb / outputLimitKb, which the
  // runner enforces per test case.
  //
  // A test case's `input` is a JSON object keyed by the declared parameter
  // names; the runner rebuilds the positional argument list from `parameters`,
  // in order.
  const challenges: {
    title: string;
    slug: string;
    description: string;
    difficulty: Difficulty;
    functionName: string;
    parameters: { name: string; type: string }[];
    returnType: string;
    starterCode: string;
    judgeMethod: JudgeMethod;
    referenceSolutionCode?: string;
    customCheckerCode?: string;
    tags: string[];
    testCases: { input: unknown; expectedOutput: unknown; isHidden: boolean }[];
  }[] = [
    {
      title: 'Two Sum',
      slug: 'two-sum',
      description:
        'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.\n\nYou may assume each input has exactly one solution, and you may not use the same element twice. Return the indices in ascending order. Return an empty array when no pair adds up to the target.',
      difficulty: 'EASY',
      functionName: 'solve',
      parameters: [
        { name: 'nums', type: 'number[]' },
        { name: 'target', type: 'number' },
      ],
      returnType: 'number[]',
      starterCode:
        'function solve(nums, target) {\n  // Write your solution here\n}\n',
      judgeMethod: 'DEEP_EQUAL',
      referenceSolutionCode:
        'function solve(nums, target) {\n' +
        '  const seen = new Map();\n' +
        '  for (let i = 0; i < nums.length; i++) {\n' +
        '    const complement = target - nums[i];\n' +
        '    if (seen.has(complement)) return [seen.get(complement), i];\n' +
        '    seen.set(nums[i], i);\n' +
        '  }\n' +
        '  return [];\n' +
        '}\n',
      tags: ['array', 'hash-map'],
      testCases: [
        { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false },
        { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], isHidden: false },
        { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], isHidden: true },
        { input: { nums: [1, 2], target: 99 }, expectedOutput: [], isHidden: true },
        { input: { nums: [], target: 0 }, expectedOutput: [], isHidden: true },
        { input: { nums: [-3, 4, 3, 90], target: 0 }, expectedOutput: [0, 2], isHidden: true },
      ],
    },
    {
      title: 'Sum of Array',
      slug: 'sum-of-array',
      description:
        'Given an array of numbers, return the sum of all of its elements. An empty array sums to 0.',
      difficulty: 'EASY',
      functionName: 'solve',
      parameters: [{ name: 'nums', type: 'number[]' }],
      returnType: 'number',
      starterCode: 'function solve(nums) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(nums) {\n  return nums.reduce((sum, n) => sum + n, 0);\n}\n',
      tags: ['array', 'math'],
      testCases: [
        { input: { nums: [1, 2, 3] }, expectedOutput: 6, isHidden: false },
        { input: { nums: [] }, expectedOutput: 0, isHidden: false },
        { input: { nums: [10, -2, 3] }, expectedOutput: 11, isHidden: true },
        { input: { nums: [-5, -5] }, expectedOutput: -10, isHidden: true },
        { input: { nums: [1000000, 1] }, expectedOutput: 1000001, isHidden: true },
      ],
    },
    {
      title: 'Reverse String',
      slug: 'reverse-string',
      description:
        'Given a string, return a new string with its characters in reverse order.',
      difficulty: 'EASY',
      functionName: 'solve',
      parameters: [{ name: 's', type: 'string' }],
      returnType: 'string',
      starterCode: 'function solve(s) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        "function solve(s) {\n  return s.split('').reverse().join('');\n}\n",
      tags: ['string'],
      testCases: [
        { input: { s: 'abc' }, expectedOutput: 'cba', isHidden: false },
        { input: { s: '' }, expectedOutput: '', isHidden: false },
        { input: { s: 'hello world' }, expectedOutput: 'dlrow olleh', isHidden: true },
        { input: { s: 'CodeClash' }, expectedOutput: 'hsalCedoC', isHidden: true },
        { input: { s: 'a' }, expectedOutput: 'a', isHidden: true },
      ],
    },
    {
      title: 'Count Vowels',
      slug: 'count-vowels',
      description:
        'Given a lowercase string, return how many of its characters are vowels (a, e, i, o, u).',
      difficulty: 'EASY',
      functionName: 'solve',
      parameters: [{ name: 's', type: 'string' }],
      returnType: 'number',
      starterCode: 'function solve(s) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        "function solve(s) {\n  return s.split('').filter((c) => 'aeiou'.includes(c)).length;\n}\n",
      tags: ['string'],
      testCases: [
        { input: { s: 'hello' }, expectedOutput: 2, isHidden: false },
        { input: { s: 'xyz' }, expectedOutput: 0, isHidden: false },
        { input: { s: 'aeiou' }, expectedOutput: 5, isHidden: true },
        { input: { s: 'programming' }, expectedOutput: 3, isHidden: true },
        { input: { s: '' }, expectedOutput: 0, isHidden: true },
      ],
    },
    {
      title: 'Largest Number',
      slug: 'largest-number',
      description:
        'Given a non-empty array of numbers, return the largest value it contains.',
      difficulty: 'EASY',
      functionName: 'solve',
      parameters: [{ name: 'nums', type: 'number[]' }],
      returnType: 'number',
      starterCode: 'function solve(nums) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode: 'function solve(nums) {\n  return Math.max(...nums);\n}\n',
      tags: ['array'],
      testCases: [
        { input: { nums: [1, 7, 3] }, expectedOutput: 7, isHidden: false },
        { input: { nums: [-4, -9] }, expectedOutput: -4, isHidden: false },
        { input: { nums: [42] }, expectedOutput: 42, isHidden: true },
        { input: { nums: [5, 5, 2] }, expectedOutput: 5, isHidden: true },
        { input: { nums: [0, -1, 1] }, expectedOutput: 1, isHidden: true },
      ],
    },
    {
      title: 'FizzBuzz Count',
      slug: 'fizzbuzz-count',
      description:
        'Given an integer n, return how many numbers from 1 to n (inclusive) are divisible by 3 or by 5.',
      difficulty: 'MEDIUM',
      functionName: 'solve',
      parameters: [{ name: 'n', type: 'number' }],
      returnType: 'number',
      starterCode: 'function solve(n) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(n) {\n' +
        '  let count = 0;\n' +
        '  for (let i = 1; i <= n; i++) {\n' +
        '    if (i % 3 === 0 || i % 5 === 0) count++;\n' +
        '  }\n' +
        '  return count;\n' +
        '}\n',
      tags: ['math', 'loops'],
      testCases: [
        { input: { n: 15 }, expectedOutput: 7, isHidden: false },
        { input: { n: 1 }, expectedOutput: 0, isHidden: false },
        { input: { n: 100 }, expectedOutput: 47, isHidden: true },
        { input: { n: 0 }, expectedOutput: 0, isHidden: true },
        { input: { n: 3 }, expectedOutput: 1, isHidden: true },
      ],
    },
  ];

  // Idempotent: re-running the seed refreshes the existing rows rather than
  // creating a second copy of every challenge.
  //
  // These are seeded straight to PUBLISHED with validationStatus NOT_CHECKED.
  // That is deliberate: the publish *endpoint* requires a passing validation
  // run, but the seed is authored data that has to exist before a runner is
  // even up. Run Validate Problem from the admin console to record a real
  // validation result for them.
  for (const c of challenges) {
    const tags = await Promise.all(
      c.tags.map((label) =>
        prisma.challengeTag.upsert({
          where: { slug: label },
          update: {},
          create: { slug: label, label },
        }),
      ),
    );

    const data = {
      title: c.title,
      description: c.description,
      difficulty: c.difficulty,
      starterCode: c.starterCode,
      functionName: c.functionName,
      parameters: c.parameters,
      returnType: c.returnType,
      judgeMethod: c.judgeMethod,
      referenceSolutionCode: c.referenceSolutionCode ?? null,
      customCheckerCode: c.customCheckerCode ?? null,
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      outputLimitKb: 64,
      timeLimitSeconds: 300,
      status: 'PUBLISHED' as const,
      creationMode: 'MANUAL' as const,
      publishedAt: new Date(),
      createdById: admin.id,
    };

    const connectTags = tags.map((tag) => ({ id: tag.id }));
    const challenge = await prisma.challenge.upsert({
      where: { slug: c.slug },
      // `set: []` first so a tag removed from this file is actually dropped.
      // Only valid on update - a create has nothing to detach.
      update: { ...data, tags: { set: [], connect: connectTags } },
      create: { ...data, slug: c.slug, tags: { connect: connectTags } },
    });

    // Replace test cases wholesale so a corrected expectation here always wins
    // over whatever is already stored. Safe because a Challenge's test cases
    // are only ever authored here or through the admin API.
    await prisma.challengeTestCase.deleteMany({
      where: { challengeId: challenge.id },
    });
    let order = 0;
    for (const tc of c.testCases) {
      await prisma.challengeTestCase.create({
        data: {
          challengeId: challenge.id,
          input: tc.input as object,
          expectedOutput: tc.expectedOutput as object,
          isHidden: tc.isHidden,
          order: order++,
        },
      });
    }
  }

  console.log('Seed finished.', {
    master: master.email,
    admin: admin.email,
    publishedChallenges: challenges.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
