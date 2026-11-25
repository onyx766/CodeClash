import { parseLeaderboardLimit } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { ProfilesService } from '../users/profiles.service';

/** Ranked players as both services read them, best rating first. */
function playersRated(ratings: number[]) {
  return ratings.map((rating, i) => ({
    id: `p${i}`,
    username: `player${i}`,
    role: 'USER',
    createdAt: new Date(0),
    country: null,
    region: null,
    city: null,
    timezone: null,
    profile: { displayName: null, avatarUrl: null, bio: null, location: null },
    stats: {
      rating,
      wins: 0,
      losses: 0,
      draws: 0,
      matchesPlayed: 0,
      totalScore: 0,
      bestStreak: 0,
      challengesSolved: 0,
    },
    preferences: { favoriteLanguages: [], favoriteTopics: [] },
  }));
}

describe('parseLeaderboardLimit', () => {
  it.each([
    [undefined, 50],
    ['', 50],
    ['abc', 50],
    ['10', 10],
    ['0', 1],
    ['-5', 1],
    ['100000', 100],
  ])('%p -> %p', (raw, expected) => {
    expect(parseLeaderboardLimit(raw)).toBe(expected);
  });
});

describe('LeaderboardService', () => {
  it('ranks only active player accounts, best rating first', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'a',
        username: 'alice',
        profile: null,
        stats: {
          rating: 1300,
          wins: 3,
          losses: 1,
          matchesPlayed: 4,
          totalScore: 0,
        },
      },
      {
        id: 'b',
        username: 'bob',
        profile: { displayName: 'Bob', avatarUrl: null },
        stats: null,
      },
    ]);
    const service = new LeaderboardService({ user: { findMany } } as never);

    const rows = await service.top(2);

    const [args] = findMany.mock.calls[0] as [{ where: object; take: number }];
    expect(args.where).toEqual({ role: 'USER', status: 'ACTIVE' });
    expect(args.take).toBe(2);
    expect(rows).toEqual([
      expect.objectContaining({
        rank: 1,
        username: 'alice',
        rating: 1300,
        matchesPlayed: 4,
      }),
      expect.objectContaining({
        rank: 2,
        username: 'bob',
        displayName: 'Bob',
        rating: 1200,
        wins: 0,
      }),
    ]);
  });

  it('gives equal ratings the same rank and skips the ranks they fill (1, 1, 1, 4, ...)', async () => {
    const players = playersRated([1500, 1500, 1500, 1400, 1300, 1300, 1200]);
    const findMany = jest.fn().mockResolvedValue(players);
    const service = new LeaderboardService({ user: { findMany } } as never);

    const rows = await service.top(50);

    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1, 4, 5, 5, 7]);
  });

  it('agrees with the profile globalRank for every player, ties included', async () => {
    const players = playersRated([1700, 1500, 1500, 1400, 1400, 1400, 1200]);
    const findMany = jest.fn().mockResolvedValue(players);
    const findUnique = jest.fn((args: { where: { username: string } }) =>
      Promise.resolve(players.find((p) => p.username === args.where.username)),
    );
    const count = jest.fn((args: { where: { rating: { gt: number } } }) =>
      Promise.resolve(
        players.filter((p) => p.stats.rating > args.where.rating.gt).length,
      ),
    );
    const prisma = { user: { findMany, findUnique }, userStats: { count } };
    const board = await new LeaderboardService(prisma as never).top(50);
    const profiles = new ProfilesService(prisma as never);

    for (const row of board) {
      const profile = await profiles.getPublicProfile(row.username);
      expect(profile.stats.globalRank).toBe(row.rank);
    }
    expect(board.map((r) => r.rank)).toEqual([1, 2, 2, 4, 4, 4, 7]);
    // Both rank the same population: the leaderboard's own filter.
    const [boardQuery] = findMany.mock.calls[0] as [{ where: object }];
    expect(count.mock.calls[0][0]).toEqual({
      where: { rating: { gt: 1700 }, user: boardQuery.where },
    });
  });
});
