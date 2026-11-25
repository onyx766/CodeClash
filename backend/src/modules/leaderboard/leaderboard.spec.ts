import { parseLeaderboardLimit } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

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
      { id: 'a', username: 'alice', profile: null, stats: { rating: 1300, wins: 3, losses: 1, matchesPlayed: 4, totalScore: 0 } },
      { id: 'b', username: 'bob', profile: { displayName: 'Bob', avatarUrl: null }, stats: null },
    ]);
    const service = new LeaderboardService({ user: { findMany } } as never);

    const rows = await service.top(2);

    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ role: 'USER', status: 'ACTIVE' });
    expect(args.take).toBe(2);
    expect(rows).toEqual([
      expect.objectContaining({ rank: 1, username: 'alice', rating: 1300, matchesPlayed: 4 }),
      expect.objectContaining({ rank: 2, username: 'bob', displayName: 'Bob', rating: 1200, wins: 0 }),
    ]);
  });
});
