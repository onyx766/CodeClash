import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('password123', {
    type: argon2.argon2id,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@codeclash.local' },
    update: {},
    create: {
      email: 'admin@codeclash.local',
      username: 'admin',
      passwordHash,
      role: 'ADMIN',
      rating: 1500,
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
        role: 'PLAYER',
      },
    });
  }

  const challenges = [
    {
      title: 'Sum of Array',
      description: 'Return the sum of numbers in an array.',
      difficulty: 'EASY',
      starterCode: 'function solve(nums) {\n  // your code\n}',
      functionName: 'solve',
      timeLimitSeconds: 5,
      testCases: [
        { input: '[1,2,3]', expectedOutput: '6', isHidden: false },
        { input: '[]', expectedOutput: '0', isHidden: false },
        { input: '[10,-2,3]', expectedOutput: '11', isHidden: true },
      ],
    },
    {
      title: 'Reverse String',
      description: 'Reverse the given string.',
      difficulty: 'EASY',
      starterCode: 'function solve(s) {\n  // your code\n}',
      functionName: 'solve',
      timeLimitSeconds: 5,
      testCases: [
        { input: '"abc"', expectedOutput: '"cba"', isHidden: false },
        { input: '""', expectedOutput: '""', isHidden: false },
        {
          input: '"hello world"',
          expectedOutput: '"dlrow olleh"',
          isHidden: true,
        },
      ],
    },
  ];

  for (const c of challenges) {
    const challenge = await prisma.challenge.create({
      data: {
        title: c.title,
        description: c.description,
        difficulty: c.difficulty as any,
        starterCode: c.starterCode,
        functionName: c.functionName,
        timeLimitSeconds: c.timeLimitSeconds,
        isPublished: true,
      },
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

  console.log('Seed finished.', { admin: admin.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
