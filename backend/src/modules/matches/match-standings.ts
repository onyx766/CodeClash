import { MatchChallengeStatus, MatchResultType, Prisma } from '@prisma/client';

export interface PlayerStanding {
  userId: string;
  solved: number;
  total: number;
  /** Sum of solveDurationMs over SOLVED challenges; 0 when nothing is solved. */
  totalSolveDurationMs: number;
  gaveUp: boolean;
}

export interface MatchStandings {
  matchId: string;
  total: number;
  players: PlayerStanding[];
}

export type MatchDecision =
  | { resultType: typeof MatchResultType.WIN; winnerId: string }
  | { resultType: typeof MatchResultType.DRAW; winnerId: null };

export const win = (winnerId: string): MatchDecision => ({
  resultType: MatchResultType.WIN,
  winnerId,
});
export const DRAW: MatchDecision = { resultType: MatchResultType.DRAW, winnerId: null };

/**
 * Solved counts are derived from progress rows on every read rather than kept
 * in a counter - PostgreSQL stays the only source of truth, so there is no
 * second value that could drift or be double-incremented.
 */
export async function loadStandings(
  db: Prisma.TransactionClient,
  matchId: string,
): Promise<MatchStandings> {
  const participants = await db.matchParticipant.findMany({
    where: { matchId },
    orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
    select: { userId: true, gaveUpAt: true },
  });
  const total = await db.matchChallenge.count({ where: { matchId } });
  const solved = await db.matchChallengeProgress.findMany({
    where: { status: MatchChallengeStatus.SOLVED, matchChallenge: { matchId } },
    select: { userId: true, solveDurationMs: true },
  });

  return {
    matchId,
    total,
    players: participants.map((p) => {
      const mine = solved.filter((row) => row.userId === p.userId);
      return {
        userId: p.userId,
        solved: mine.length,
        total,
        totalSolveDurationMs: mine.reduce((sum, row) => sum + (row.solveDurationMs ?? 0), 0),
        gaveUp: !!p.gaveUpAt,
      };
    }),
  };
}

/**
 * Timeout result: more challenges solved wins; with the same (non-zero)
 * count, the lower total solve time wins; anything else is a draw. Two
 * players with nothing solved draw - a total of 0ms there means "no solves",
 * not "fastest".
 */
export function decideTimeoutResult(players: PlayerStanding[]): MatchDecision {
  if (players.length !== 2) {
    throw new Error(`A battle needs exactly 2 players, found ${players.length}.`);
  }
  const [a, b] = players;
  if (a.solved !== b.solved) return win(a.solved > b.solved ? a.userId : b.userId);
  if (a.solved === 0) return DRAW;
  if (a.totalSolveDurationMs !== b.totalSolveDurationMs) {
    return win(a.totalSolveDurationMs < b.totalSolveDurationMs ? a.userId : b.userId);
  }
  return DRAW;
}
