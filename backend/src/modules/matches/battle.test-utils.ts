import { randomUUID } from 'crypto';

/**
 * In-memory stand-in for the subset of PrismaClient the battle engine uses,
 * so specs can drive real services end to end.
 *
 * Supports scalar filters (equals/not/in/notIn/lt/lte/gt/gte), relation
 * filters (some/none/every, to-one), compound unique keys, select/include with
 * nested where/orderBy/take, increment/decrement, and unique constraints
 * (throws P2002).
 *
 * `$transaction(cb)` honours `SELECT ... FOR UPDATE` issued through
 * `tx.$queryRaw`: the lock is held until the callback settles, and other
 * transactions asking for the same row wait - which is what makes the
 * concurrency specs meaningful rather than tautological. There is no rollback;
 * services validate before they write, so specs never depend on one.
 */

type Row = Record<string, any>;

interface Relation {
  model: string;
  many: boolean;
  /** Field on the owning row. */
  local: string;
  /** Field on the related row that must equal `local`. */
  foreign: string;
}

const one = (model: string, local: string, foreign = 'id'): Relation => ({
  model,
  many: false,
  local,
  foreign,
});
const many = (model: string, foreign: string, local = 'id'): Relation => ({
  model,
  many: true,
  local,
  foreign,
});

const RELATIONS: Record<string, Record<string, Relation>> = {
  user: { profile: one('userProfile', 'id', 'userId'), stats: one('userStats', 'id', 'userId') },
  room: { players: many('roomPlayer', 'roomId'), match: one('match', 'id', 'roomId') },
  roomPlayer: { user: one('user', 'userId'), room: one('room', 'roomId') },
  match: {
    room: one('room', 'roomId'),
    participants: many('matchParticipant', 'matchId'),
    challenges: many('matchChallenge', 'matchId'),
    submissions: many('submission', 'matchId'),
  },
  matchParticipant: { user: one('user', 'userId'), match: one('match', 'matchId') },
  matchChallenge: {
    match: one('match', 'matchId'),
    challenge: one('challenge', 'challengeId'),
    progress: many('matchChallengeProgress', 'matchChallengeId'),
  },
  matchChallengeProgress: {
    matchChallenge: one('matchChallenge', 'matchChallengeId'),
    user: one('user', 'userId'),
  },
  challenge: { testCases: many('challengeTestCase', 'challengeId') },
  submission: {
    user: one('user', 'userId'),
    challenge: one('challenge', 'challengeId'),
    match: one('match', 'matchId'),
    matchChallenge: one('matchChallenge', 'matchChallengeId'),
  },
};

const DEFAULTS: Record<string, () => Row> = {
  user: () => ({ role: 'USER', status: 'ACTIVE', passwordHash: 'x' }),
  userProfile: () => ({ displayName: null, avatarUrl: null }),
  userStats: () => ({
    rating: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    matchesPlayed: 0,
    currentStreak: 0,
    bestStreak: 0,
    casualWins: 0,
    casualLosses: 0,
    casualDraws: 0,
    casualMatchesPlayed: 0,
  }),
  room: () => ({ status: 'WAITING', maxPlayers: 2, expiresAt: null }),
  roomPlayer: () => ({ isReady: false, joinedAt: new Date() }),
  challenge: () => ({
    description: 'Solve it.',
    difficulty: 'EASY',
    status: 'PUBLISHED',
    problemType: 'FUNCTION',
    validationStatus: 'PASSED',
    archivedAt: null,
    functionName: 'solve',
    parameters: [{ name: 'n', type: 'number' }],
    returnType: 'number',
    starterCode: 'function solve(n) {\n}\n',
    judgeMethod: 'DEEP_EQUAL',
    referenceSolutionCode: null,
    customCheckerCode: null,
    testGeneratorCode: null,
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    outputLimitKb: 64,
    timeLimitSeconds: 300,
  }),
  challengeTestCase: () => ({ isHidden: true, expectedOutput: null }),
  match: () => ({
    roomId: null,
    status: 'PENDING',
    type: 'PRIVATE_ROOM',
    ratingEligible: false,
    ratingReason: null,
    ratingProcessedAt: null,
    winnerId: null,
    finishReason: null,
    resultType: null,
    startedAt: null,
    expiresAt: null,
    finishedAt: null,
    readyDeadline: null,
  }),
  matchParticipant: () => ({ readyAt: null, ratingAfter: null, gaveUpAt: null, joinedAt: new Date() }),
  matchChallenge: () => ({}),
  matchChallengeProgress: () => ({
    status: 'NOT_STARTED',
    attempts: 0,
    firstAttemptAt: null,
    solvedAt: null,
    solveDurationMs: null,
    bestSubmissionId: null,
  }),
  submission: () => ({
    status: 'QUEUED',
    language: 'javascript',
    matchId: null,
    matchChallengeId: null,
    passedTests: null,
    totalTests: null,
    runtimeMs: null,
    memoryUsedKb: null,
    runnerJobId: null,
    completedAt: null,
  }),
};

const UNIQUE: Record<string, string[][]> = {
  user: [['username']],
  userStats: [['userId']],
  room: [['code']],
  match: [['roomId']],
  matchParticipant: [['matchId', 'userId']],
  matchChallenge: [['matchId', 'challengeId'], ['matchId', 'position']],
  matchChallengeProgress: [['matchChallengeId', 'userId'], ['bestSubmissionId']],
};

const OPERATORS = new Set(['equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte']);

const isPlainObject = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !(value instanceof Date) && !Array.isArray(value);

const isOperatorObject = (value: unknown): value is Row =>
  isPlainObject(value) &&
  Object.keys(value).length > 0 &&
  Object.keys(value).every((key) => OPERATORS.has(key));

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  return (a ?? null) === (b ?? null);
}

function compare(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : (a as number | string);
  const bv = b instanceof Date ? b.getTime() : (b as number | string);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function matchScalar(value: unknown, cond: unknown): boolean {
  if (!isOperatorObject(cond)) return same(value, cond);
  for (const [op, arg] of Object.entries(cond)) {
    if (arg === undefined) continue;
    const ok =
      op === 'equals'
        ? same(value, arg)
        : op === 'not'
          ? !matchScalar(value, arg)
          : op === 'in'
            ? (arg as unknown[]).some((a) => same(value, a))
            : op === 'notIn'
              ? !(arg as unknown[]).some((a) => same(value, a))
              : value !== null &&
                value !== undefined &&
                (op === 'lt'
                  ? compare(value, arg) < 0
                  : op === 'lte'
                    ? compare(value, arg) <= 0
                    : op === 'gt'
                      ? compare(value, arg) > 0
                      : compare(value, arg) >= 0);
    if (!ok) return false;
  }
  return true;
}

const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

class ModelDelegate {
  constructor(
    private readonly db: FakePrisma,
    private readonly model: string,
  ) {}

  private filter(where?: Row) {
    return this.db.table(this.model).filter((row) => this.db.matches(this.model, row, where));
  }

  private query(args: Row = {}) {
    let rows = this.db.sort(this.filter(args.where), args.orderBy);
    if (args.skip) rows = rows.slice(args.skip);
    if (args.take !== undefined) rows = rows.slice(0, args.take);
    return rows;
  }

  async findUnique(args: Row) {
    const [row] = this.query(args);
    return row ? this.db.project(this.model, row, args) : null;
  }

  async findFirst(args: Row = {}) {
    return this.findUnique(args);
  }

  async findMany(args: Row = {}) {
    return this.query(args).map((row) => this.db.project(this.model, row, args));
  }

  async count(args: Row = {}) {
    return this.filter(args.where).length;
  }

  async create(args: Row) {
    const row = this.db.insert(this.model, args.data);
    return this.db.project(this.model, row, args);
  }

  async createMany(args: Row) {
    const data: Row[] = Array.isArray(args.data) ? args.data : [args.data];
    for (const item of data) this.db.insert(this.model, item);
    return { count: data.length };
  }

  async update(args: Row) {
    const [row] = this.filter(args.where);
    if (!row) {
      throw Object.assign(new Error(`No ${this.model} matched the update.`), { code: 'P2025' });
    }
    this.apply(row, args.data);
    return this.db.project(this.model, row, args);
  }

  async updateMany(args: Row) {
    const rows = this.filter(args.where);
    for (const row of rows) this.apply(row, args.data);
    return { count: rows.length };
  }

  async deleteMany(args: Row = {}) {
    const doomed = new Set(this.filter(args.where));
    const table = this.db.table(this.model);
    const kept = table.filter((row) => !doomed.has(row));
    table.splice(0, table.length, ...kept);
    return { count: doomed.size };
  }

  private apply(row: Row, data: Row) {
    const next: Row = { ...row };
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (isPlainObject(value) && ('increment' in value || 'decrement' in value)) {
        next[key] = (next[key] ?? 0) + (value.increment ?? 0) - (value.decrement ?? 0);
      } else {
        next[key] = value;
      }
    }
    next.updatedAt = new Date();
    this.db.assertUnique(this.model, next, row);
    Object.assign(row, next);
  }
}

export class FakePrisma {
  readonly lockLog: string[] = [];
  private readonly tables = new Map<string, Row[]>();
  private readonly lockTails = new Map<string, Promise<void>>();

  readonly user = new ModelDelegate(this, 'user');
  readonly userProfile = new ModelDelegate(this, 'userProfile');
  readonly userStats = new ModelDelegate(this, 'userStats');
  readonly room = new ModelDelegate(this, 'room');
  readonly roomPlayer = new ModelDelegate(this, 'roomPlayer');
  readonly challenge = new ModelDelegate(this, 'challenge');
  readonly challengeTestCase = new ModelDelegate(this, 'challengeTestCase');
  readonly match = new ModelDelegate(this, 'match');
  readonly matchParticipant = new ModelDelegate(this, 'matchParticipant');
  readonly matchChallenge = new ModelDelegate(this, 'matchChallenge');
  readonly matchChallengeProgress = new ModelDelegate(this, 'matchChallengeProgress');
  readonly submission = new ModelDelegate(this, 'submission');

  table(model: string): Row[] {
    if (!this.tables.has(model)) this.tables.set(model, []);
    return this.tables.get(model)!;
  }

  /** Live rows - mutate them directly to arrange a scenario. */
  rows(model: string): Row[] {
    return this.table(model);
  }

  seed(model: string, rows: Row[]): Row[] {
    return rows.map((row) => this.insert(model, row));
  }

  insert(model: string, data: Row): Row {
    const now = new Date();
    const row: Row = { id: randomUUID(), createdAt: now, updatedAt: now, ...DEFAULTS[model]?.() };
    for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
    this.assertUnique(model, row);
    this.table(model).push(row);
    return row;
  }

  assertUnique(model: string, row: Row, replacing?: Row) {
    for (const fields of UNIQUE[model] ?? []) {
      if (fields.some((field) => row[field] === null || row[field] === undefined)) continue;
      const clash = this.table(model).some(
        (other) =>
          other !== replacing &&
          other !== row &&
          fields.every((field) => same(other[field], row[field])),
      );
      if (clash) {
        throw Object.assign(new Error(`Unique constraint failed on ${model}(${fields.join(', ')})`), {
          code: 'P2002',
        });
      }
    }
  }

  private relatedRows(model: string, row: Row, relation: Relation): Row[] {
    const local = row[relation.local];
    if (local === null || local === undefined) return [];
    return this.table(relation.model).filter((other) => same(other[relation.foreign], local));
  }

  matches(model: string, row: Row, where?: Row): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, cond]) => {
      if (cond === undefined) return true;
      if (key === 'AND') return ([] as Row[]).concat(cond).every((w) => this.matches(model, row, w));
      if (key === 'OR') return (cond as Row[]).some((w) => this.matches(model, row, w));
      if (key === 'NOT') return !([] as Row[]).concat(cond).some((w) => this.matches(model, row, w));

      const relation = RELATIONS[model]?.[key];
      if (relation) {
        const related = this.relatedRows(model, row, relation);
        if (relation.many) {
          if (cond.some) return related.some((r) => this.matches(relation.model, r, cond.some));
          if (cond.none) return !related.some((r) => this.matches(relation.model, r, cond.none));
          if (cond.every) return related.every((r) => this.matches(relation.model, r, cond.every));
          throw new Error(`FakePrisma: unsupported list filter on ${model}.${key}`);
        }
        if (cond === null) return related.length === 0;
        return related.length > 0 && this.matches(relation.model, related[0], cond.is ?? cond);
      }

      if (!(key in row) && isPlainObject(cond) && key.includes('_')) {
        const fields = key.split('_');
        return Object.entries(cond).every(([field, value]) => fields.includes(field) && same(row[field], value));
      }
      return matchScalar(row[key], cond);
    });
  }

  sort(rows: Row[], orderBy?: Row | Row[]): Row[] {
    if (!orderBy) return [...rows];
    const specs = ([] as Row[]).concat(orderBy);
    return [...rows].sort((a, b) => {
      for (const spec of specs) {
        const [[field, direction]] = Object.entries(spec);
        const av = a[field];
        const bv = b[field];
        if ((av ?? null) === null && (bv ?? null) === null) continue;
        if ((av ?? null) === null) return 1;
        if ((bv ?? null) === null) return -1;
        const c = compare(av, bv);
        if (c !== 0) return direction === 'desc' ? -c : c;
      }
      return 0;
    });
  }

  project(model: string, row: Row, args?: Row): Row {
    if (args?.select) {
      const out: Row = {};
      for (const [key, spec] of Object.entries(args.select as Row)) {
        if (!spec) continue;
        out[key] = RELATIONS[model]?.[key]
          ? this.resolve(model, row, key, spec === true ? {} : spec)
          : clone(row[key]);
      }
      return out;
    }
    const out: Row = clone(row);
    for (const [key, spec] of Object.entries((args?.include ?? {}) as Row)) {
      if (spec) out[key] = this.resolve(model, row, key, spec === true ? {} : spec);
    }
    return out;
  }

  private resolve(model: string, row: Row, key: string, spec: Row) {
    const relation = RELATIONS[model][key];
    const related = this.relatedRows(model, row, relation);
    if (!relation.many) return related[0] ? this.project(relation.model, related[0], spec) : null;
    let rows = this.sort(
      related.filter((r) => this.matches(relation.model, r, spec.where)),
      spec.orderBy,
    );
    if (spec.take !== undefined) rows = rows.slice(0, spec.take);
    return rows.map((r) => this.project(relation.model, r, spec));
  }

  async $queryRaw(): Promise<unknown[]> {
    return [];
  }

  async $transaction(arg: unknown): Promise<unknown> {
    if (Array.isArray(arg)) return Promise.all(arg);
    const held = new Map<string, () => void>();
    const tx = Object.create(this) as FakePrisma;
    (tx as { $queryRaw: unknown }).$queryRaw = async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      const lock = /FROM "(\w+)" WHERE "id" = \?\s+FOR UPDATE/.exec(strings.join('?'));
      if (lock) await this.acquire(`${lock[1]}:${String(values[0])}`, held);
      return [];
    };
    try {
      return await (arg as (tx: FakePrisma) => Promise<unknown>)(tx);
    } finally {
      for (const release of held.values()) release();
    }
  }

  private async acquire(key: string, held: Map<string, () => void>) {
    if (held.has(key)) return;
    const previous = this.lockTails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => (release = resolve));
    const tail = previous.then(() => mine);
    this.lockTails.set(key, tail);
    held.set(key, () => {
      release();
      if (this.lockTails.get(key) === tail) this.lockTails.delete(key);
    });
    await previous;
    this.lockLog.push(key);
  }
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

/** Strings that must never reach a player: if one appears in a response, it leaked. */
export const HIDDEN_SECRET = 'HIDDEN_EXPECTED_7f3a';
export const REFERENCE_SECRET = 'REFERENCE_SOLUTION_91c2';
export const CHECKER_SECRET = 'CUSTOM_CHECKER_44d0';
export const GENERATOR_SECRET = 'GENERATOR_CODE_5b8e';

export const RYAN = 'ryan';
export const MASTER1 = 'master1';
export const STRANGER = 'stranger';
export const ADMIN = 'admin';

export function seedPlayers(db: FakePrisma) {
  db.seed('user', [
    { id: RYAN, username: 'ryan', email: 'ryan@test' },
    { id: MASTER1, username: 'master1', email: 'master1@test' },
    { id: STRANGER, username: 'stranger', email: 'stranger@test' },
    { id: ADMIN, username: 'admin', email: 'admin@test', role: 'ADMIN' },
  ]);
  db.seed('userStats', [
    { userId: RYAN, rating: 1850 },
    { userId: MASTER1, rating: 1720 },
  ]);
}

let challengeCounter = 0;

export function seedChallenge(db: FakePrisma, overrides: Row = {}, options: { hiddenTests?: boolean } = {}) {
  const n = ++challengeCounter;
  const [challenge] = db.seed('challenge', [
    {
      title: `Challenge ${n}`,
      slug: `challenge-${n}`,
      referenceSolutionCode: `function solve(n) { return n; } // ${REFERENCE_SECRET}`,
      customCheckerCode: `// ${CHECKER_SECRET}`,
      testGeneratorCode: `// ${GENERATOR_SECRET}`,
      ...overrides,
    },
  ]);
  db.seed('challengeTestCase', [
    { challengeId: challenge.id, order: 0, isHidden: false, input: { n: 1 }, expectedOutput: 1 },
    ...(options.hiddenTests === false
      ? [{ challengeId: challenge.id, order: 1, isHidden: false, input: { n: 2 }, expectedOutput: 2 }]
      : [
          {
            challengeId: challenge.id,
            order: 1,
            isHidden: true,
            input: { n: 2, note: HIDDEN_SECRET },
            expectedOutput: HIDDEN_SECRET,
          },
          { challengeId: challenge.id, order: 2, isHidden: true, input: { n: 3 }, expectedOutput: 3 },
        ]),
  ]);
  return challenge;
}

export function seedPool(db: FakePrisma, counts: Record<string, number>) {
  return Object.entries(counts).flatMap(([difficulty, count]) =>
    Array.from({ length: count }, () => seedChallenge(db, { difficulty })),
  );
}

/** Every one of these is published-looking but must never be selected. */
export function seedIneligible(db: FakePrisma) {
  return [
    seedChallenge(db, { title: 'DECOY draft', status: 'DRAFT' }),
    seedChallenge(db, { title: 'DECOY archived', status: 'ARCHIVED', archivedAt: new Date() }),
    seedChallenge(db, { title: 'DECOY unvalidated', validationStatus: 'NOT_CHECKED' }),
    seedChallenge(db, { title: 'DECOY failed validation', validationStatus: 'FAILED' }),
    seedChallenge(db, { title: 'DECOY stdio', problemType: 'STANDARD_IO' }),
    seedChallenge(db, { title: 'DECOY samples only' }, { hiddenTests: false }),
  ];
}

export function seedRoom(
  db: FakePrisma,
  options: { code?: string; hostId?: string; guestId?: string | null; status?: string; expiresAt?: Date | null } = {},
) {
  const hostId = options.hostId ?? RYAN;
  const [room] = db.seed('room', [
    {
      code: options.code ?? 'KZHBQM',
      hostId,
      status: options.status ?? 'WAITING',
      expiresAt: options.expiresAt === undefined ? new Date(Date.now() + 30 * 60_000) : options.expiresAt,
    },
  ]);
  const players = [hostId, ...(options.guestId === null ? [] : [options.guestId ?? MASTER1])];
  db.seed(
    'roomPlayer',
    players.map((userId, index) => ({ roomId: room.id, userId, joinedAt: new Date(Date.now() + index) })),
  );
  return room;
}
