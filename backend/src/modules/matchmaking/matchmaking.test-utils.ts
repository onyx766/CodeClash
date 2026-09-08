/**
 * Minimal in-memory stand-in for the ioredis client, implementing just the
 * commands matchmaking.redis.ts uses. The `eval` implementation deliberately
 * mirrors the real CLAIM_SCRIPT's check-then-mutate logic with no `await`
 * between the ZSCORE checks and the ZREM/SET mutations, so - exactly like
 * real Redis executing a Lua script - two concurrent calls into `eval()`
 * cannot interleave mid-claim. This is what makes the concurrency test
 * meaningful rather than a tautology.
 */
export class FakeRedis {
  private zsets = new Map<string, Map<string, number>>();
  private strings = new Map<string, { value: string; expiresAt: number | null }>();

  private zset(key: string): Map<string, number> {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    return this.zsets.get(key)!;
  }

  async zadd(key: string, score: number, member: string) {
    this.zset(key).set(member, score);
    return 1;
  }

  async zrem(key: string, ...members: string[]) {
    const z = this.zset(key);
    let count = 0;
    for (const m of members) if (z.delete(m)) count++;
    return count;
  }

  async zscore(key: string, member: string) {
    const z = this.zset(key);
    return z.has(member) ? String(z.get(member)) : null;
  }

  async zmscore(key: string, ...members: string[]) {
    const z = this.zset(key);
    return members.map((m) => (z.has(m) ? String(z.get(m)) : null));
  }

  async zrangebyscore(key: string, min: number, max: number, withscores?: string) {
    const z = this.zset(key);
    const entries = [...z.entries()]
      .filter(([, score]) => score >= min && score <= max)
      .sort((a, b) => a[1] - b[1]);
    if (withscores) {
      const out: string[] = [];
      for (const [member, score] of entries) out.push(member, String(score));
      return out;
    }
    return entries.map(([member]) => member);
  }

  async zrange(key: string, start: number, stop: number) {
    const entries = [...this.zset(key).entries()].sort((a, b) => a[1] - b[1]).map(([m]) => m);
    const end = stop === -1 ? entries.length : stop + 1;
    return entries.slice(start, end);
  }

  private expired(key: string): boolean {
    const entry = this.strings.get(key);
    if (!entry) return true;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.strings.delete(key);
      return true;
    }
    return false;
  }

  async set(key: string, value: string, ...args: unknown[]) {
    let ttlMs: number | null = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'EX') ttlMs = Number(args[i + 1]) * 1000;
      if (args[i] === 'PX') ttlMs = Number(args[i + 1]);
    }
    this.strings.set(key, { value, expiresAt: ttlMs !== null ? Date.now() + ttlMs : null });
    return 'OK';
  }

  async get(key: string) {
    if (this.expired(key)) return null;
    return this.strings.get(key)!.value;
  }

  async del(...keys: string[]) {
    let count = 0;
    for (const key of keys) {
      if (this.strings.delete(key)) count++;
      if (this.zsets.delete(key)) count++;
    }
    return count;
  }

  async exists(key: string) {
    if (this.zsets.has(key) && this.zset(key).size > 0) return 1;
    return this.expired(key) ? 0 : this.strings.has(key) ? 1 : 0;
  }

  async eval(_script: string, numKeys: number, ...rest: unknown[]) {
    const keys = rest.slice(0, numKeys) as string[];
    const args = rest.slice(numKeys) as string[];
    const [ratingKey, joinedKey, reservationKeyA, reservationKeyB] = keys;
    const [userA, userB, ttlSeconds] = args;

    const ratingZ = this.zset(ratingKey);
    if (!ratingZ.has(userA)) return 0;
    if (!ratingZ.has(userB)) return 0;

    ratingZ.delete(userA);
    ratingZ.delete(userB);
    this.zset(joinedKey).delete(userA);
    this.zset(joinedKey).delete(userB);

    await this.set(reservationKeyA, userB, 'EX', ttlSeconds);
    await this.set(reservationKeyB, userA, 'EX', ttlSeconds);
    return 1;
  }

  multi() {
    const ops: Array<() => Promise<unknown>> = [];
    const chain = {
      zadd: (key: string, score: number, member: string) => {
        ops.push(() => this.zadd(key, score, member));
        return chain;
      },
      zrem: (key: string, ...members: string[]) => {
        ops.push(() => this.zrem(key, ...members));
        return chain;
      },
      set: (key: string, value: string, ...args: unknown[]) => {
        ops.push(() => this.set(key, value, ...args));
        return chain;
      },
      del: (...keys: string[]) => {
        ops.push(() => this.del(...keys));
        return chain;
      },
      exec: async () => {
        const results: Array<[null, unknown]> = [];
        for (const op of ops) results.push([null, await op()]);
        return results;
      },
    };
    return chain;
  }
}
