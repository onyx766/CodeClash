import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // create admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@codeclash.local';
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: 'admin',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv', // placeholder, use real hash in prod
      role: 'ADMIN',
    },
  });

  // create sample users
  await prisma.user.upsert({ where: { email: 'alice@example.com' }, update: {}, create: { email: 'alice@example.com', username: 'alice', passwordHash: '$2b$10$alice', role: 'PLAYER' } });
  await prisma.user.upsert({ where: { email: 'bob@example.com' }, update: {}, create: { email: 'bob@example.com', username: 'bob', passwordHash: '$2b$10$bob', role: 'PLAYER' } });

  // sample challenges
  const c1 = await prisma.challenge.upsert({
    where: { title: 'Add One' },
    update: {},
    create: {
      title: 'Add One',
      description: 'Return input + 1',
      difficulty: 'EASY',
      starterCode: 'module.exports.solve = (x) => { /* implement */ }',
      functionName: 'solve',
      timeLimitSeconds: 2,
      isPublished: true,
      testCases: {
        create: [
          { input: '1', expectedOutput: '2', isHidden: false },
          { input: '5', expectedOutput: '6', isHidden: false },
          { input: '999', expectedOutput: '1000', isHidden: true },
        ],
      },
    },
  });

  const c2 = await prisma.challenge.upsert({
    where: { title: 'Square' },
    update: {},
    create: {
      title: 'Square',
      description: 'Return input squared',
      difficulty: 'EASY',
      starterCode: 'module.exports.solve = (x) => { /* implement */ }',
      functionName: 'solve',
      timeLimitSeconds: 2,
      isPublished: true,
      testCases: {
        create: [
          { input: '2', expectedOutput: '4', isHidden: false },
          { input: '10', expectedOutput: '100', isHidden: false },
        ],
      },
    },
  });

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

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

  // Create some player accounts
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

  // Sample challenges
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
        { input: '"hello world"', expectedOutput: '"dlrow olleh"', isHidden: true },
      ],
    },
    // more challenges...
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

  console.log('Seed finished.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
