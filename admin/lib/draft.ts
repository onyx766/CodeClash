import type {
  AdminChallenge,
  Difficulty,
  JudgeMethod,
  UpsertChallengePayload,
  ValueType,
} from "./types";

/**
 * The single in-memory shape the Create Challenge editor works with.
 *
 * All three creation modes (manual, AI, JSON import) produce one of these, so
 * everything downstream - the editor, validation, save, publish - is identical
 * no matter where the content came from.
 *
 * Test-case JSON is held as *text* rather than parsed values so an admin can
 * type freely and see a parse error in place; it is only turned into JSON when
 * the draft is sent to the server.
 */

export interface DraftParameter {
  key: string;
  name: string;
  type: ValueType;
}

export interface DraftTestCase {
  key: string;
  id?: string;
  inputText: string;
  expectedText: string;
  isHidden: boolean;
}

export interface ChallengeDraft {
  title: string;
  slug: string;
  /** Once the admin edits the slug by hand, the title stops overwriting it. */
  slugTouched: boolean;
  description: string;
  difficulty: Difficulty;
  tags: string[];

  functionName: string;
  parameters: DraftParameter[];
  returnType: ValueType;
  starterCode: string;

  judgeMethod: JudgeMethod;
  referenceSolutionCode: string;
  customCheckerCode: string;
  testGeneratorCode: string;

  timeLimitMs: number;
  memoryLimitMb: number;
  outputLimitKb: number;

  testCases: DraftTestCase[];
}

// ---------------------------------------------------------------------------
// option metadata (mirrors backend/src/modules/challenges/challenge.constants)
// ---------------------------------------------------------------------------

export const VALUE_TYPES: ValueType[] = [
  "number",
  "string",
  "boolean",
  "null",
  "number[]",
  "string[]",
  "boolean[]",
  "array",
  "object",
  "any",
];

export const DIFFICULTIES: { value: Difficulty; label: string; tone: string }[] = [
  { value: "EASY", label: "Easy", tone: "bg-green" },
  { value: "MEDIUM", label: "Medium", tone: "bg-amber" },
  { value: "HARD", label: "Hard", tone: "bg-rose" },
  { value: "EXPERT", label: "Expert", tone: "bg-violet" },
];

export const JUDGE_METHODS: {
  value: JudgeMethod;
  title: string;
  description: string;
  accent: "blue" | "violet" | "teal" | "amber";
}[] = [
  {
    value: "EXACT",
    title: "Exact Output",
    description: "Compare primitive output exactly. Strict and type-aware.",
    accent: "blue",
  },
  {
    value: "DEEP_EQUAL",
    title: "Deep Equality",
    description: "Compare arrays and objects structurally. Recommended default.",
    accent: "violet",
  },
  {
    value: "CUSTOM_CHECKER",
    title: "Custom Checker",
    description: "Use custom validation when several outputs are valid.",
    accent: "teal",
  },
  {
    value: "REFERENCE",
    title: "Reference Solution",
    description: "Calculate answers using a trusted reference implementation.",
    accent: "amber",
  },
];

export const LIMITS = {
  timeLimitMs: { min: 100, max: 10_000, step: 100, default: 2000 },
  memoryLimitMb: { min: 32, max: 512, step: 32, default: 128 },
  outputLimitKb: { min: 1, max: 1024, step: 8, default: 64 },
} as const;

export const MIN_PUBLIC_TESTS = 1;
export const MIN_HIDDEN_TESTS = 3;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

let keyCounter = 0;
export function nextKey(prefix = "k") {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

/** Regenerates starter code from the contract, e.g. after a parameter rename. */
export function buildStarterCode(
  functionName: string,
  parameters: DraftParameter[],
): string {
  const args = parameters
    .map((parameter) => parameter.name.trim())
    .filter(Boolean)
    .join(", ");
  return `function ${functionName || "solve"}(${args}) {\n  // Write your solution here\n}\n`;
}

/** A test-case input skeleton with one entry per declared parameter. */
export function buildInputSkeleton(parameters: DraftParameter[]): string {
  const defaults: Record<ValueType, string> = {
    number: "0",
    string: '""',
    boolean: "false",
    null: "null",
    "number[]": "[]",
    "string[]": "[]",
    "boolean[]": "[]",
    array: "[]",
    object: "{}",
    any: "null",
  };
  const named = parameters.filter((parameter) => parameter.name.trim());
  if (!named.length) return "{}";
  const body = named
    .map(
      (parameter) =>
        `  ${JSON.stringify(parameter.name.trim())}: ${defaults[parameter.type] ?? "null"}`,
    )
    .join(",\n");
  return `{\n${body}\n}`;
}

export function emptyTestCase(
  parameters: DraftParameter[],
  isHidden: boolean,
): DraftTestCase {
  return {
    key: nextKey("test"),
    inputText: buildInputSkeleton(parameters),
    expectedText: "null",
    isHidden,
  };
}

export function emptyDraft(): ChallengeDraft {
  const parameters: DraftParameter[] = [
    { key: nextKey("param"), name: "nums", type: "number[]" },
    { key: nextKey("param"), name: "target", type: "number" },
  ];
  return {
    title: "",
    slug: "",
    slugTouched: false,
    description: "",
    difficulty: "EASY",
    tags: [],
    functionName: "solve",
    parameters,
    returnType: "number[]",
    starterCode: buildStarterCode("solve", parameters),
    judgeMethod: "DEEP_EQUAL",
    referenceSolutionCode: "",
    customCheckerCode: "",
    testGeneratorCode: "",
    timeLimitMs: LIMITS.timeLimitMs.default,
    memoryLimitMb: LIMITS.memoryLimitMb.default,
    outputLimitKb: LIMITS.outputLimitKb.default,
    testCases: [
      emptyTestCase(parameters, false),
      emptyTestCase(parameters, true),
      emptyTestCase(parameters, true),
      emptyTestCase(parameters, true),
    ],
  };
}

const stringify = (value: unknown) =>
  value === undefined ? "null" : JSON.stringify(value, null, 2);

/** Server challenge -> editor draft. */
export function draftFromChallenge(challenge: AdminChallenge): ChallengeDraft {
  return {
    title: challenge.title,
    slug: challenge.slug,
    slugTouched: true,
    description: challenge.description,
    difficulty: challenge.difficulty,
    tags: challenge.tags.map((tag) => tag.label),
    functionName: challenge.functionContract.functionName,
    parameters: challenge.functionContract.parameters.map((parameter) => ({
      key: nextKey("param"),
      name: parameter.name,
      type: parameter.type,
    })),
    returnType: challenge.functionContract.returnType,
    starterCode: challenge.functionContract.starterCode,
    judgeMethod: challenge.judge.method,
    referenceSolutionCode: challenge.judge.referenceSolutionCode ?? "",
    customCheckerCode: challenge.judge.customCheckerCode ?? "",
    testGeneratorCode: challenge.judge.testGeneratorCode ?? "",
    timeLimitMs: challenge.limits.timeLimitMs,
    memoryLimitMb: challenge.limits.memoryLimitMb,
    outputLimitKb: challenge.limits.outputLimitKb,
    testCases: challenge.testCases.map((testCase) => ({
      key: nextKey("test"),
      id: testCase.id,
      inputText: stringify(testCase.input),
      expectedText: stringify(testCase.expectedOutput),
      isHidden: testCase.isHidden,
    })),
  };
}

/**
 * Import/AI payload -> editor draft.
 *
 * Both of those arrive as a server-validated UpsertChallengePayload, which is
 * exactly what the manual editor produces, so this is a straight adaptation
 * rather than a second parsing path.
 */
export function draftFromPayload(payload: UpsertChallengePayload): ChallengeDraft {
  const base = emptyDraft();
  const parameters: DraftParameter[] =
    payload.functionContract?.parameters.map((parameter) => ({
      key: nextKey("param"),
      name: parameter.name,
      type: parameter.type,
    })) ?? base.parameters;

  return {
    ...base,
    title: payload.title ?? "",
    slug: payload.slug ?? slugify(payload.title ?? ""),
    slugTouched: !!payload.slug,
    description: payload.description ?? "",
    difficulty: payload.difficulty ?? "EASY",
    tags: payload.tags ?? [],
    functionName: payload.functionContract?.functionName ?? base.functionName,
    parameters,
    returnType: payload.functionContract?.returnType ?? base.returnType,
    starterCode:
      payload.functionContract?.starterCode ??
      buildStarterCode(
        payload.functionContract?.functionName ?? base.functionName,
        parameters,
      ),
    judgeMethod: payload.judgeMethod ?? "DEEP_EQUAL",
    referenceSolutionCode: payload.referenceSolutionCode ?? "",
    customCheckerCode: payload.customCheckerCode ?? "",
    testGeneratorCode: payload.testGeneratorCode ?? "",
    timeLimitMs: payload.timeLimitMs ?? base.timeLimitMs,
    memoryLimitMb: payload.memoryLimitMb ?? base.memoryLimitMb,
    outputLimitKb: payload.outputLimitKb ?? base.outputLimitKb,
    testCases:
      payload.testCases?.map((testCase) => ({
        key: nextKey("test"),
        inputText: stringify(testCase.input),
        expectedText: stringify(testCase.expectedOutput),
        isHidden: testCase.isHidden ?? true,
      })) ?? [],
  };
}

export class DraftSerializationError extends Error {}

/**
 * Editor draft -> API payload.
 *
 * Throws on unparseable test JSON so a typo surfaces here instead of as an
 * opaque 400. Everything beyond well-formedness (identifier legality, inputs
 * matching the contract, judge configuration) is re-checked server-side.
 */
export function draftToPayload(draft: ChallengeDraft): UpsertChallengePayload {
  const parameters = draft.parameters
    .map((parameter) => ({
      name: parameter.name.trim(),
      type: parameter.type,
    }))
    .filter((parameter) => parameter.name);

  const parseJson = (text: string, label: string): unknown => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new DraftSerializationError(`${label}: ${(error as Error).message}`);
    }
  };

  const testCases = draft.testCases.map((testCase, index) => ({
    input: parseJson(testCase.inputText, `Test case #${index + 1} input`),
    expectedOutput: parseJson(
      testCase.expectedText,
      `Test case #${index + 1} expected output`,
    ),
    isHidden: testCase.isHidden,
  }));

  const orNull = (code: string) => (code.trim() ? code : null);

  return {
    title: draft.title.trim(),
    slug: draft.slug.trim() || slugify(draft.title),
    description: draft.description,
    difficulty: draft.difficulty,
    tags: draft.tags,
    functionContract: {
      functionName: draft.functionName.trim(),
      parameters,
      returnType: draft.returnType,
      starterCode: draft.starterCode,
    },
    judgeMethod: draft.judgeMethod,
    referenceSolutionCode: orNull(draft.referenceSolutionCode),
    customCheckerCode: orNull(draft.customCheckerCode),
    testGeneratorCode: orNull(draft.testGeneratorCode),
    timeLimitMs: draft.timeLimitMs,
    memoryLimitMb: draft.memoryLimitMb,
    outputLimitKb: draft.outputLimitKb,
    testCases,
  };
}

/**
 * Editor draft -> PATCH payload for a PUBLISHED challenge.
 *
 * A published challenge only accepts presentational edits; its contract,
 * judge, limits and tests are what live matches are scored against. Those
 * fields are left out entirely rather than echoed back, so the server never
 * sees a judging change (and never answers CHALLENGE_LOCKED) for a title or
 * description fix. The slug stays as published.
 */
export function draftToPresentationPayload(
  draft: ChallengeDraft,
): UpsertChallengePayload {
  return {
    title: draft.title.trim(),
    description: draft.description,
    difficulty: draft.difficulty,
    tags: draft.tags,
  };
}

/**
 * Client-side pre-flight. Purely for immediate feedback in the form - the
 * server runs its own version of every one of these and is the authority.
 */
export function draftIssues(draft: ChallengeDraft): string[] {
  const issues: string[] = [];
  const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  if (draft.title.trim().length < 3) issues.push("Title must be at least 3 characters.");
  if (draft.title.trim().length > 120) issues.push("Title must be at most 120 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug.trim())) {
    issues.push("Slug must be lowercase letters, numbers and single hyphens.");
  }
  if (draft.description.trim().length < 10) {
    issues.push("Description must be at least 10 characters.");
  }
  if (!identifier.test(draft.functionName.trim())) {
    issues.push("Function name must be a valid JavaScript identifier.");
  }

  const seen = new Set<string>();
  for (const parameter of draft.parameters) {
    const name = parameter.name.trim();
    if (!name) continue;
    if (!identifier.test(name)) {
      issues.push(`Parameter "${name}" is not a valid JavaScript identifier.`);
    }
    if (seen.has(name)) issues.push(`Duplicate parameter name "${name}".`);
    seen.add(name);
  }

  if (draft.judgeMethod === "CUSTOM_CHECKER" && !draft.customCheckerCode.trim()) {
    issues.push("The Custom Checker judge method requires checker code.");
  }
  if (draft.judgeMethod === "REFERENCE" && !draft.referenceSolutionCode.trim()) {
    issues.push("The Reference Solution judge method requires a reference solution.");
  }

  const publicTests = draft.testCases.filter((test) => !test.isHidden).length;
  const hiddenTests = draft.testCases.length - publicTests;
  if (publicTests < MIN_PUBLIC_TESTS) {
    issues.push(`At least ${MIN_PUBLIC_TESTS} public test case is required.`);
  }
  if (hiddenTests < MIN_HIDDEN_TESTS) {
    issues.push(`At least ${MIN_HIDDEN_TESTS} hidden test cases are required.`);
  }

  draft.testCases.forEach((testCase, index) => {
    for (const [label, text] of [
      ["input", testCase.inputText],
      ["expected output", testCase.expectedText],
    ] as const) {
      if (!text.trim()) continue;
      try {
        JSON.parse(text);
      } catch {
        issues.push(`Test case #${index + 1} ${label} is not valid JSON.`);
      }
    }
  });

  return issues;
}
