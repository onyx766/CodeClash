import type Redis from 'ioredis';
import {
  MATCHMAKING_JOINED_ZSET,
  MATCHMAKING_RATING_ZSET,
  lastSeenKey,
  recentPairKey,
  reservationKey,
} from './matchmaking.constants';
import { QueueEntry } from './matchmaking.types';

/**
 * Atomically claims a pair: fails (returns false) if either user is no
 * longer present in the rating ZSET (already claimed by another instance,
 * or cancelled), otherwise removes both from both ZSETs and reserves them.
 * Single Lua script -> Redis executes it single-threadedly, so this is safe
 * across multiple backend instances without any in-process mutex.
 */
const CLAIM_SCRIPT = `
local ratingKey = KEYS[1]
local joinedKey = KEYS[2]
local reservationKeyA = KEYS[3]
local reservationKeyB = KEYS[4]
local userA = ARGV[1]
local userB = ARGV[2]
local ttlSeconds = ARGV[3]

if redis.call('ZSCORE', ratingKey, userA) == false then
  return 0
end
if redis.call('ZSCORE', ratingKey, userB) == false then
  return 0
end

redis.call('ZREM', ratingKey, userA)
redis.call('ZREM', ratingKey, userB)
redis.call('ZREM', joinedKey, userA)
redis.call('ZREM', joinedKey, userB)

redis.call('SET', reservationKeyA, userB, 'EX', ttlSeconds)
redis.call('SET', reservationKeyB, userA, 'EX', ttlSeconds)

return 1
`;

export async function claimPair(
  client: Redis,
  userAId: string,
  userBId: string,
  reservationTtlSeconds: number,
): Promise<boolean> {
  const result = await client.eval(
    CLAIM_SCRIPT,
    4,
    MATCHMAKING_RATING_ZSET,
    MATCHMAKING_JOINED_ZSET,
    reservationKey(userAId),
    reservationKey(userBId),
    userAId,
    userBId,
    String(reservationTtlSeconds),
  );
  return result === 1;
}

export async function enqueue(
  client: Redis,
  userId: string,
  rating: number,
  joinedAt: number,
  staleTimeoutMs: number,
): Promise<void> {
  await client
    .multi()
    .zadd(MATCHMAKING_RATING_ZSET, rating, userId)
    .zadd(MATCHMAKING_JOINED_ZSET, joinedAt, userId)
    .set(lastSeenKey(userId), '1', 'PX', staleTimeoutMs)
    .exec();
}

/** Re-adds users to both ZSETs preserving their original scores - used to roll
 * back a claim when Postgres Match creation fails. */
export async function requeueAll(
  client: Redis,
  entries: QueueEntry[],
  staleTimeoutMs: number,
): Promise<void> {
  if (entries.length === 0) return;
  const multi = client.multi();
  for (const entry of entries) {
    multi.zadd(MATCHMAKING_RATING_ZSET, entry.rating, entry.userId);
    multi.zadd(MATCHMAKING_JOINED_ZSET, entry.joinedAt, entry.userId);
    multi.set(lastSeenKey(entry.userId), '1', 'PX', staleTimeoutMs);
  }
  await multi.exec();
}

export async function dequeue(client: Redis, userId: string): Promise<void> {
  await client
    .multi()
    .zrem(MATCHMAKING_RATING_ZSET, userId)
    .zrem(MATCHMAKING_JOINED_ZSET, userId)
    .del(lastSeenKey(userId))
    .exec();
}

export async function getQueueEntry(
  client: Redis,
  userId: string,
): Promise<QueueEntry | null> {
  const [rating, joinedAt] = await Promise.all([
    client.zscore(MATCHMAKING_RATING_ZSET, userId),
    client.zscore(MATCHMAKING_JOINED_ZSET, userId),
  ]);
  if (rating === null || joinedAt === null) return null;
  return { userId, rating: Number(rating), joinedAt: Number(joinedAt) };
}

export async function touchLastSeen(
  client: Redis,
  userId: string,
  staleTimeoutMs: number,
): Promise<void> {
  await client.set(lastSeenKey(userId), '1', 'PX', staleTimeoutMs);
}

/** Oldest-first (ascending joinedAt) - used to bound how many the worker processes per tick. */
export async function getOldestWaiting(
  client: Redis,
  limit: number,
): Promise<string[]> {
  return client.zrange(MATCHMAKING_JOINED_ZSET, 0, Math.max(0, limit - 1));
}

/** All queued userIds, for the staleness sweep. */
export async function getAllWaiting(client: Redis): Promise<string[]> {
  return client.zrange(MATCHMAKING_RATING_ZSET, 0, -1);
}

export async function isStale(client: Redis, userId: string): Promise<boolean> {
  const seen = await client.exists(lastSeenKey(userId));
  return seen === 0;
}

/**
 * Candidates within [minRating, maxRating], each with their queue-joinedAt,
 * excluding the searching user themself even if queue state is malformed.
 */
export async function findCandidatesInRange(
  client: Redis,
  userId: string,
  minRating: number,
  maxRating: number,
): Promise<QueueEntry[]> {
  const raw = await client.zrangebyscore(
    MATCHMAKING_RATING_ZSET,
    minRating,
    maxRating,
    'WITHSCORES',
  );
  const candidates: { userId: string; rating: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const candidateId = raw[i];
    if (candidateId === userId) continue; // never match a user with themself
    candidates.push({ userId: candidateId, rating: Number(raw[i + 1]) });
  }
  if (candidates.length === 0) return [];

  const joinedScores = await client.zmscore(
    MATCHMAKING_JOINED_ZSET,
    ...candidates.map((c) => c.userId),
  );
  return candidates
    .map((c, i) => ({
      userId: c.userId,
      rating: c.rating,
      joinedAt: joinedScores[i] === null ? Date.now() : Number(joinedScores[i]),
    }))
    .filter((c) => Number.isFinite(c.joinedAt));
}

export async function getReservationPartner(
  client: Redis,
  userId: string,
): Promise<string | null> {
  return client.get(reservationKey(userId));
}

export async function clearReservations(
  client: Redis,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;
  await client.del(...userIds.map((id) => reservationKey(id)));
}

export async function isRecentPair(
  client: Redis,
  userAId: string,
  userBId: string,
): Promise<boolean> {
  const exists = await client.exists(recentPairKey(userAId, userBId));
  return exists === 1;
}

export async function markRecentPair(
  client: Redis,
  userAId: string,
  userBId: string,
  ttlSeconds: number,
): Promise<void> {
  if (ttlSeconds <= 0) return;
  await client.set(recentPairKey(userAId, userBId), '1', 'EX', ttlSeconds);
}
