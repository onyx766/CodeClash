import * as argon2 from 'argon2';
import { Difficulty, JudgeMethod, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'password123';

const flag = (name: string, fallback: boolean): boolean => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
};

/**
 * Seeds the staff accounts, optional demo players and the starter challenge
 * set. Safe to re-run: users are upserted and never overwritten.
 *
 * Environment:
 * - SEED_ONLY_IF_EMPTY=true    skip entirely when any user exists (what the
 *                              Docker entrypoint uses on every start)
 * - SEED_ADMIN_PASSWORD        password for master@ / admin@codeclash.local
 * - SEED_PLAYER_PASSWORD       password for the demo players
 * - SEED_DEMO_PLAYERS=false    do not create player1..player5
 * Both passwords default to "password123" - change them for any deployment
 * reachable by other people.
 */
async function main() {
  if (flag('SEED_ONLY_IF_EMPTY', false) && (await prisma.user.count()) > 0) {
    console.log('Seed skipped: the database already has users.');
    return;
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const playerPassword = process.env.SEED_PLAYER_PASSWORD || DEFAULT_PASSWORD;
  if (adminPassword === DEFAULT_PASSWORD) {
    console.warn(
      'Seeding staff accounts with the default password - set SEED_ADMIN_PASSWORD for any shared deployment.',
    );
  }
  const hash = (plain: string) => argon2.hash(plain, { type: argon2.argon2id });
  const passwordHash = await hash(adminPassword);
  const playerPasswordHash =
    playerPassword === adminPassword ? passwordHash : await hash(playerPassword);

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

  const demoPlayers = flag('SEED_DEMO_PLAYERS', true) ? 5 : 0;
  for (let i = 1; i <= demoPlayers; i++) {
    await prisma.user.upsert({
      where: { email: `player${i}@codeclash.local` },
      update: {},
      create: {
        email: `player${i}@codeclash.local`,
        username: `player${i}`,
        passwordHash: playerPasswordHash,
        role: 'USER',
        profile: { create: {} },
        stats: { create: {} },
        preferences: { create: {} },
      },
    });
  }

  // A battle plays MATCH_CHALLENGE_COUNT (5) distinct challenges, preferring
  // 2 EASY / 2 MEDIUM / 1 HARD, so keep at least that many eligible ones here -
  // otherwise a match refuses to start with INSUFFICIENT_BATTLE_CHALLENGES -
  // and several of each so repeated matches do not replay the same set.
  // Every challenge needs at least one hidden test to be eligible.
  //
  // These are seeded with validationStatus NOT_CHECKED (see below), and battles
  // only use challenges that PASSED validation. Either run Validate Problem on
  // each one from the admin console, or set MATCH_REQUIRE_VALIDATED_CHALLENGES
  // =false for local development.
  //
  // timeLimitSeconds is a suggested solving time shown in the admin console;
  // battles use one overall clock (MATCH_DURATION_MINUTES). It is NOT an
  // execution limit - those are timeLimitMs / memoryLimitMb / outputLimitKb,
  // which the runner enforces per test case.
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
    {
      title: 'Valid Parentheses',
      slug: 'valid-parentheses',
      description:
        "Given a string containing only the characters '(', ')', '[', ']', '{' and '}', return true if every bracket is closed by the same type of bracket in the correct order, and false otherwise. An empty string is valid.",
      difficulty: 'EASY',
      functionName: 'solve',
      parameters: [{ name: 's', type: 'string' }],
      returnType: 'boolean',
      starterCode: 'function solve(s) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(s) {\n' +
        "  const pairs = { ')': '(', ']': '[', '}': '{' };\n" +
        '  const stack = [];\n' +
        '  for (const c of s) {\n' +
        "    if (c === '(' || c === '[' || c === '{') stack.push(c);\n" +
        '    else if (stack.pop() !== pairs[c]) return false;\n' +
        '  }\n' +
        '  return stack.length === 0;\n' +
        '}\n',
      tags: ['string', 'stack'],
      testCases: [
        { input: { s: '()' }, expectedOutput: true, isHidden: false },
        { input: { s: '()[]{}' }, expectedOutput: true, isHidden: false },
        { input: { s: '(]' }, expectedOutput: false, isHidden: true },
        { input: { s: '([)]' }, expectedOutput: false, isHidden: true },
        { input: { s: '{[]}' }, expectedOutput: true, isHidden: true },
        { input: { s: '' }, expectedOutput: true, isHidden: true },
        { input: { s: '((' }, expectedOutput: false, isHidden: true },
      ],
    },
    {
      title: 'Maximum Subarray',
      slug: 'maximum-subarray',
      description:
        'Given a non-empty array of integers, return the largest sum of any contiguous, non-empty subarray.',
      difficulty: 'MEDIUM',
      functionName: 'solve',
      parameters: [{ name: 'nums', type: 'number[]' }],
      returnType: 'number',
      starterCode: 'function solve(nums) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(nums) {\n' +
        '  let best = nums[0];\n' +
        '  let current = nums[0];\n' +
        '  for (let i = 1; i < nums.length; i++) {\n' +
        '    current = Math.max(nums[i], current + nums[i]);\n' +
        '    best = Math.max(best, current);\n' +
        '  }\n' +
        '  return best;\n' +
        '}\n',
      tags: ['array', 'dynamic-programming'],
      testCases: [
        { input: { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] }, expectedOutput: 6, isHidden: false },
        { input: { nums: [1] }, expectedOutput: 1, isHidden: false },
        { input: { nums: [5, 4, -1, 7, 8] }, expectedOutput: 23, isHidden: true },
        { input: { nums: [-3, -1, -2] }, expectedOutput: -1, isHidden: true },
        { input: { nums: [0, 0, 0] }, expectedOutput: 0, isHidden: true },
      ],
    },
    {
      title: 'Longest Substring Without Repeating Characters',
      slug: 'longest-substring-without-repeating-characters',
      description:
        'Given a string, return the length of the longest substring that contains no repeated characters.',
      difficulty: 'MEDIUM',
      functionName: 'solve',
      parameters: [{ name: 's', type: 'string' }],
      returnType: 'number',
      starterCode: 'function solve(s) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(s) {\n' +
        '  const last = new Map();\n' +
        '  let start = 0;\n' +
        '  let best = 0;\n' +
        '  for (let i = 0; i < s.length; i++) {\n' +
        '    if (last.has(s[i]) && last.get(s[i]) >= start) start = last.get(s[i]) + 1;\n' +
        '    last.set(s[i], i);\n' +
        '    best = Math.max(best, i - start + 1);\n' +
        '  }\n' +
        '  return best;\n' +
        '}\n',
      tags: ['string', 'sliding-window'],
      testCases: [
        { input: { s: 'abcabcbb' }, expectedOutput: 3, isHidden: false },
        { input: { s: 'bbbbb' }, expectedOutput: 1, isHidden: false },
        { input: { s: 'pwwkew' }, expectedOutput: 3, isHidden: true },
        { input: { s: '' }, expectedOutput: 0, isHidden: true },
        { input: { s: 'dvdf' }, expectedOutput: 3, isHidden: true },
        { input: { s: 'abba' }, expectedOutput: 2, isHidden: true },
      ],
    },
    {
      title: 'Trapping Rain Water',
      slug: 'trapping-rain-water',
      description:
        'Given an array of non-negative integers describing an elevation map where each bar has width 1, return how many units of rain water it can trap after raining.',
      difficulty: 'HARD',
      functionName: 'solve',
      parameters: [{ name: 'height', type: 'number[]' }],
      returnType: 'number',
      starterCode: 'function solve(height) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(height) {\n' +
        '  let left = 0;\n' +
        '  let right = height.length - 1;\n' +
        '  let leftMax = 0;\n' +
        '  let rightMax = 0;\n' +
        '  let water = 0;\n' +
        '  while (left < right) {\n' +
        '    if (height[left] < height[right]) {\n' +
        '      leftMax = Math.max(leftMax, height[left]);\n' +
        '      water += leftMax - height[left];\n' +
        '      left++;\n' +
        '    } else {\n' +
        '      rightMax = Math.max(rightMax, height[right]);\n' +
        '      water += rightMax - height[right];\n' +
        '      right--;\n' +
        '    }\n' +
        '  }\n' +
        '  return water;\n' +
        '}\n',
      tags: ['array', 'two-pointers'],
      testCases: [
        { input: { height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }, expectedOutput: 6, isHidden: false },
        { input: { height: [4, 2, 0, 3, 2, 5] }, expectedOutput: 9, isHidden: false },
        { input: { height: [] }, expectedOutput: 0, isHidden: true },
        { input: { height: [1, 2, 3] }, expectedOutput: 0, isHidden: true },
        { input: { height: [3, 0, 3] }, expectedOutput: 3, isHidden: true },
        { input: { height: [5, 4, 1, 2] }, expectedOutput: 1, isHidden: true },
      ],
    },
    {
      title: 'Product of Array Except Self',
      slug: 'product-of-array-except-self',
      description:
        'Given an array `nums`, return an array where element `i` is the product of every element of `nums` except `nums[i]`.\n\nSolve it without using division.',
      difficulty: 'MEDIUM',
      functionName: 'solve',
      parameters: [{ name: 'nums', type: 'number[]' }],
      returnType: 'number[]',
      starterCode: 'function solve(nums) {\n  // Write your solution here\n}\n',
      judgeMethod: 'DEEP_EQUAL',
      referenceSolutionCode:
        'function solve(nums) {\n' +
        '  const result = new Array(nums.length).fill(1);\n' +
        '  let prefix = 1;\n' +
        '  for (let i = 0; i < nums.length; i++) {\n' +
        '    result[i] = prefix;\n' +
        '    prefix *= nums[i];\n' +
        '  }\n' +
        '  let suffix = 1;\n' +
        '  for (let i = nums.length - 1; i >= 0; i--) {\n' +
        '    result[i] *= suffix;\n' +
        '    suffix *= nums[i];\n' +
        '  }\n' +
        '  return result.map((value) => value + 0);\n' +
        '}\n',
      tags: ['array', 'prefix-sum'],
      testCases: [
        { input: { nums: [1, 2, 3, 4] }, expectedOutput: [24, 12, 8, 6], isHidden: false },
        { input: { nums: [-1, 1, 0, -3, 3] }, expectedOutput: [0, 0, 9, 0, 0], isHidden: false },
        { input: { nums: [2, 3] }, expectedOutput: [3, 2], isHidden: true },
        { input: { nums: [0, 0] }, expectedOutput: [0, 0], isHidden: true },
        { input: { nums: [5, 1, 1, 1] }, expectedOutput: [1, 5, 5, 5], isHidden: true },
        { input: { nums: [3, -2, 4, 1] }, expectedOutput: [-8, 12, -6, -24], isHidden: true },
      ],
    },
    {
      title: 'Merge Intervals',
      slug: 'merge-intervals',
      description:
        'Given an array of intervals `[start, end]`, merge every pair of overlapping intervals and return the merged intervals sorted by start.\n\nIntervals that touch (one ends where the next starts) count as overlapping.',
      difficulty: 'MEDIUM',
      functionName: 'solve',
      parameters: [{ name: 'intervals', type: 'array' }],
      returnType: 'array',
      starterCode: 'function solve(intervals) {\n  // Write your solution here\n}\n',
      judgeMethod: 'DEEP_EQUAL',
      referenceSolutionCode:
        'function solve(intervals) {\n' +
        '  const sorted = intervals.map((i) => [i[0], i[1]]).sort((a, b) => a[0] - b[0]);\n' +
        '  const merged = [];\n' +
        '  for (const [start, end] of sorted) {\n' +
        '    const last = merged[merged.length - 1];\n' +
        '    if (last && start <= last[1]) last[1] = Math.max(last[1], end);\n' +
        '    else merged.push([start, end]);\n' +
        '  }\n' +
        '  return merged;\n' +
        '}\n',
      tags: ['array', 'sorting'],
      testCases: [
        { input: { intervals: [[1, 3], [2, 6], [8, 10], [15, 18]] }, expectedOutput: [[1, 6], [8, 10], [15, 18]], isHidden: false },
        { input: { intervals: [[1, 4], [4, 5]] }, expectedOutput: [[1, 5]], isHidden: false },
        { input: { intervals: [] }, expectedOutput: [], isHidden: true },
        { input: { intervals: [[1, 4], [0, 4]] }, expectedOutput: [[0, 4]], isHidden: true },
        { input: { intervals: [[1, 4], [2, 3]] }, expectedOutput: [[1, 4]], isHidden: true },
        { input: { intervals: [[5, 6], [1, 2], [3, 4]] }, expectedOutput: [[1, 2], [3, 4], [5, 6]], isHidden: true },
      ],
    },
    {
      title: 'Coin Change',
      slug: 'coin-change',
      description:
        'Given coin denominations `coins` (an unlimited supply of each) and a target `amount`, return the fewest coins that add up to `amount`, or `-1` if it cannot be made.',
      difficulty: 'MEDIUM',
      functionName: 'solve',
      parameters: [
        { name: 'coins', type: 'number[]' },
        { name: 'amount', type: 'number' },
      ],
      returnType: 'number',
      starterCode: 'function solve(coins, amount) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(coins, amount) {\n' +
        '  const best = new Array(amount + 1).fill(Infinity);\n' +
        '  best[0] = 0;\n' +
        '  for (let total = 1; total <= amount; total++) {\n' +
        '    for (const coin of coins) {\n' +
        '      if (coin <= total && best[total - coin] + 1 < best[total]) best[total] = best[total - coin] + 1;\n' +
        '    }\n' +
        '  }\n' +
        '  return best[amount] === Infinity ? -1 : best[amount];\n' +
        '}\n',
      tags: ['dynamic-programming'],
      testCases: [
        { input: { coins: [1, 2, 5], amount: 11 }, expectedOutput: 3, isHidden: false },
        { input: { coins: [2], amount: 3 }, expectedOutput: -1, isHidden: false },
        { input: { coins: [1], amount: 0 }, expectedOutput: 0, isHidden: true },
        { input: { coins: [1], amount: 2 }, expectedOutput: 2, isHidden: true },
        { input: { coins: [186, 419, 83, 408], amount: 6249 }, expectedOutput: 20, isHidden: true },
        { input: { coins: [2, 5, 10, 1], amount: 27 }, expectedOutput: 4, isHidden: true },
      ],
    },
    {
      title: 'Spiral Matrix',
      slug: 'spiral-matrix',
      description:
        'Given an `m x n` matrix, return all of its elements in spiral order: along the top row, down the right column, back along the bottom row, up the left column, and so on inwards.',
      difficulty: 'MEDIUM',
      functionName: 'solve',
      parameters: [{ name: 'matrix', type: 'array' }],
      returnType: 'number[]',
      starterCode: 'function solve(matrix) {\n  // Write your solution here\n}\n',
      judgeMethod: 'DEEP_EQUAL',
      referenceSolutionCode:
        'function solve(matrix) {\n' +
        '  const result = [];\n' +
        '  if (!matrix.length) return result;\n' +
        '  let top = 0, bottom = matrix.length - 1, left = 0, right = matrix[0].length - 1;\n' +
        '  while (top <= bottom && left <= right) {\n' +
        '    for (let c = left; c <= right; c++) result.push(matrix[top][c]);\n' +
        '    top++;\n' +
        '    for (let r = top; r <= bottom; r++) result.push(matrix[r][right]);\n' +
        '    right--;\n' +
        '    if (top <= bottom) {\n' +
        '      for (let c = right; c >= left; c--) result.push(matrix[bottom][c]);\n' +
        '      bottom--;\n' +
        '    }\n' +
        '    if (left <= right) {\n' +
        '      for (let r = bottom; r >= top; r--) result.push(matrix[r][left]);\n' +
        '      left++;\n' +
        '    }\n' +
        '  }\n' +
        '  return result;\n' +
        '}\n',
      tags: ['array', 'matrix', 'simulation'],
      testCases: [
        { input: { matrix: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }, expectedOutput: [1, 2, 3, 6, 9, 8, 7, 4, 5], isHidden: false },
        { input: { matrix: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] }, expectedOutput: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7], isHidden: false },
        { input: { matrix: [] }, expectedOutput: [], isHidden: true },
        { input: { matrix: [[7]] }, expectedOutput: [7], isHidden: true },
        { input: { matrix: [[1], [2], [3]] }, expectedOutput: [1, 2, 3], isHidden: true },
        { input: { matrix: [[1, 2], [3, 4]] }, expectedOutput: [1, 2, 4, 3], isHidden: true },
      ],
    },
    {
      title: 'Edit Distance',
      slug: 'edit-distance',
      description:
        'Return the minimum number of single-character edits (insert, delete or replace) needed to turn `word1` into `word2`.',
      difficulty: 'HARD',
      functionName: 'solve',
      parameters: [
        { name: 'word1', type: 'string' },
        { name: 'word2', type: 'string' },
      ],
      returnType: 'number',
      starterCode: 'function solve(word1, word2) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(word1, word2) {\n' +
        '  let previous = Array.from({ length: word2.length + 1 }, (_, j) => j);\n' +
        '  for (let i = 1; i <= word1.length; i++) {\n' +
        '    const current = [i];\n' +
        '    for (let j = 1; j <= word2.length; j++) {\n' +
        '      current[j] = word1[i - 1] === word2[j - 1]\n' +
        '        ? previous[j - 1]\n' +
        '        : 1 + Math.min(previous[j - 1], previous[j], current[j - 1]);\n' +
        '    }\n' +
        '    previous = current;\n' +
        '  }\n' +
        '  return previous[word2.length];\n' +
        '}\n',
      tags: ['string', 'dynamic-programming'],
      testCases: [
        { input: { word1: 'horse', word2: 'ros' }, expectedOutput: 3, isHidden: false },
        { input: { word1: 'intention', word2: 'execution' }, expectedOutput: 5, isHidden: false },
        { input: { word1: '', word2: '' }, expectedOutput: 0, isHidden: true },
        { input: { word1: '', word2: 'abc' }, expectedOutput: 3, isHidden: true },
        { input: { word1: 'abc', word2: 'abc' }, expectedOutput: 0, isHidden: true },
        { input: { word1: 'kitten', word2: 'sitting' }, expectedOutput: 3, isHidden: true },
        { input: { word1: 'sunday', word2: 'saturday' }, expectedOutput: 3, isHidden: true },
      ],
    },
    {
      title: 'Largest Rectangle in Histogram',
      slug: 'largest-rectangle-in-histogram',
      description:
        'Given the bar heights of a histogram where every bar has width 1, return the area of the largest rectangle that fits inside the histogram.',
      difficulty: 'HARD',
      functionName: 'solve',
      parameters: [{ name: 'heights', type: 'number[]' }],
      returnType: 'number',
      starterCode: 'function solve(heights) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(heights) {\n' +
        '  const stack = [];\n' +
        '  let best = 0;\n' +
        '  for (let i = 0; i <= heights.length; i++) {\n' +
        '    const height = i === heights.length ? 0 : heights[i];\n' +
        '    while (stack.length && heights[stack[stack.length - 1]] >= height) {\n' +
        '      const top = heights[stack.pop()];\n' +
        '      const left = stack.length ? stack[stack.length - 1] + 1 : 0;\n' +
        '      best = Math.max(best, top * (i - left));\n' +
        '    }\n' +
        '    stack.push(i);\n' +
        '  }\n' +
        '  return best;\n' +
        '}\n',
      tags: ['array', 'stack'],
      testCases: [
        { input: { heights: [2, 1, 5, 6, 2, 3] }, expectedOutput: 10, isHidden: false },
        { input: { heights: [2, 4] }, expectedOutput: 4, isHidden: false },
        { input: { heights: [] }, expectedOutput: 0, isHidden: true },
        { input: { heights: [1] }, expectedOutput: 1, isHidden: true },
        { input: { heights: [2, 2, 2, 2] }, expectedOutput: 8, isHidden: true },
        { input: { heights: [6, 2, 5, 4, 5, 1, 6] }, expectedOutput: 12, isHidden: true },
        { input: { heights: [1, 2, 3, 4, 5] }, expectedOutput: 9, isHidden: true },
      ],
    },
    {
      title: 'N-Queens Count',
      slug: 'n-queens-count',
      description:
        'Return how many ways `n` queens can be placed on an `n x n` chessboard so that no two queens attack each other (no shared row, column or diagonal).',
      difficulty: 'HARD',
      functionName: 'solve',
      parameters: [{ name: 'n', type: 'number' }],
      returnType: 'number',
      starterCode: 'function solve(n) {\n  // Write your solution here\n}\n',
      judgeMethod: 'EXACT',
      referenceSolutionCode:
        'function solve(n) {\n' +
        '  let count = 0;\n' +
        '  const columns = new Set();\n' +
        '  const diagonals = new Set();\n' +
        '  const antiDiagonals = new Set();\n' +
        '  function place(row) {\n' +
        '    if (row === n) {\n' +
        '      count++;\n' +
        '      return;\n' +
        '    }\n' +
        '    for (let col = 0; col < n; col++) {\n' +
        '      if (columns.has(col) || diagonals.has(row - col) || antiDiagonals.has(row + col)) continue;\n' +
        '      columns.add(col);\n' +
        '      diagonals.add(row - col);\n' +
        '      antiDiagonals.add(row + col);\n' +
        '      place(row + 1);\n' +
        '      columns.delete(col);\n' +
        '      diagonals.delete(row - col);\n' +
        '      antiDiagonals.delete(row + col);\n' +
        '    }\n' +
        '  }\n' +
        '  place(0);\n' +
        '  return count;\n' +
        '}\n',
      tags: ['backtracking'],
      testCases: [
        { input: { n: 4 }, expectedOutput: 2, isHidden: false },
        { input: { n: 1 }, expectedOutput: 1, isHidden: false },
        { input: { n: 2 }, expectedOutput: 0, isHidden: true },
        { input: { n: 3 }, expectedOutput: 0, isHidden: true },
        { input: { n: 6 }, expectedOutput: 4, isHidden: true },
        { input: { n: 8 }, expectedOutput: 92, isHidden: true },
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
      // Re-seeding rewrites the judging fields and test cases below, so any
      // earlier validation no longer describes them: drop it, and the API's
      // startup auto-validation re-checks the challenge in the sandbox.
      update: {
        ...data,
        validationStatus: 'NOT_CHECKED',
        validatedAt: null,
        validationChecks: Prisma.DbNull,
        validationFingerprint: null,
        tags: { set: [], connect: connectTags },
      },
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
    demoPlayers,
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
