import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

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
  // solution, and what Round.endsAt is derived from. It is NOT the sandbox
  // execution timeout - see EXECUTION_TIMEOUT_SECONDS in RoundsService.
  //
  // The runner invokes a solution as fn(input) with exactly one argument, so
  // each test case encodes all of its arguments as a single JSON value.
  const challenges = [
    {
      title: 'Sum of Array',
      description:
        'Given an array of numbers, return the sum of all of its elements. An empty array sums to 0.',
      difficulty: 'EASY',
      starterCode: 'function solve(nums) {\n  // your code here\n}',
      functionName: 'solve',
      timeLimitSeconds: 300,
      testCases: [
        { input: '[1,2,3]', expectedOutput: '6', isHidden: false },
        { input: '[]', expectedOutput: '0', isHidden: false },
        { input: '[10,-2,3]', expectedOutput: '11', isHidden: true },
        { input: '[-5,-5]', expectedOutput: '-10', isHidden: true },
      ],
    },
    {
      title: 'Reverse String',
      description:
        'Given a string, return a new string with its characters in reverse order.',
      difficulty: 'EASY',
      starterCode: 'function solve(s) {\n  // your code here\n}',
      functionName: 'solve',
      timeLimitSeconds: 300,
      testCases: [
        { input: '"abc"', expectedOutput: '"cba"', isHidden: false },
        { input: '""', expectedOutput: '""', isHidden: false },
        {
          input: '"hello world"',
          expectedOutput: '"dlrow olleh"',
          isHidden: true,
        },
        { input: '"CodeClash"', expectedOutput: '"hsalCedoC"', isHidden: true },
      ],
    },
    {
      title: 'Count Vowels',
      description:
        'Given a lowercase string, return how many of its characters are vowels (a, e, i, o, u).',
      difficulty: 'EASY',
      starterCode: 'function solve(s) {\n  // your code here\n}',
      functionName: 'solve',
      timeLimitSeconds: 300,
      testCases: [
        { input: '"hello"', expectedOutput: '2', isHidden: false },
        { input: '"xyz"', expectedOutput: '0', isHidden: false },
        { input: '"aeiou"', expectedOutput: '5', isHidden: true },
        { input: '"programming"', expectedOutput: '3', isHidden: true },
      ],
    },
    {
      title: 'Largest Number',
      description:
        'Given a non-empty array of numbers, return the largest value it contains.',
      difficulty: 'EASY',
      starterCode: 'function solve(nums) {\n  // your code here\n}',
      functionName: 'solve',
      timeLimitSeconds: 300,
      testCases: [
        { input: '[1,7,3]', expectedOutput: '7', isHidden: false },
        { input: '[-4,-9]', expectedOutput: '-4', isHidden: false },
        { input: '[42]', expectedOutput: '42', isHidden: true },
        { input: '[5,5,2]', expectedOutput: '5', isHidden: true },
      ],
    },
    {
      title: 'FizzBuzz Count',
      description:
        'Given an integer n, return how many numbers from 1 to n (inclusive) are divisible by 3 or by 5.',
      difficulty: 'MEDIUM',
      starterCode: 'function solve(n) {\n  // your code here\n}',
      functionName: 'solve',
      timeLimitSeconds: 300,
      testCases: [
        { input: '15', expectedOutput: '7', isHidden: false },
        { input: '1', expectedOutput: '0', isHidden: false },
        { input: '100', expectedOutput: '47', isHidden: true },
        { input: '0', expectedOutput: '0', isHidden: true },
      ],
    },
  ];

  // Idempotent: re-running the seed refreshes the existing rows rather than
  // creating a second copy of every challenge.
  for (const c of challenges) {
    const existing = await prisma.challenge.findFirst({
      where: { title: c.title },
    });

    const data = {
      title: c.title,
      description: c.description,
      difficulty: c.difficulty as any,
      starterCode: c.starterCode,
      functionName: c.functionName,
      timeLimitSeconds: c.timeLimitSeconds,
      isPublished: true,
    };

    const challenge = existing
      ? await prisma.challenge.update({ where: { id: existing.id }, data })
      : await prisma.challenge.create({ data });

    // Replace test cases wholesale so a corrected expectation here always wins
    // over whatever is already stored. Safe because a Challenge's test cases
    // are only ever authored here or through the admin API.
    await prisma.challengeTestCase.deleteMany({
      where: { challengeId: challenge.id },
    });
    for (const tc of c.testCases) {
      await prisma.challengeTestCase.create({
        data: {
          challengeId: challenge.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
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
