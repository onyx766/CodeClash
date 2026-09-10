/**
 * Authoring limits shared by the admin DTOs, the JSON importer and the
 * validation service. Kept in one place so the admin UI, the API contract and
 * the runner all agree on what a publishable challenge looks like.
 */

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 120;

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 120;
/** lowercase letters/digits in hyphen-separated groups, e.g. `two-sum` */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 20_000;

export const FUNCTION_NAME_MAX_LENGTH = 64;
export const PARAMETER_NAME_MAX_LENGTH = 32;
export const MAX_PARAMETERS = 8;

export const MAX_TAGS = 10;
export const TAG_MAX_LENGTH = 32;

/** Per-challenge cap on any single executable code field. */
export const MAX_CODE_LENGTH = 20_000;
/** Cap on one test case once serialised, to keep runner payloads bounded. */
export const MAX_TEST_CASE_JSON_BYTES = 64 * 1024;
export const MAX_TEST_CASES = 200;
/** Rejects pathological nesting in imported/AI-supplied JSON values. */
export const MAX_JSON_DEPTH = 12;

// Execution limits. The runner enforces these per test case; the ranges here
// are what an admin is allowed to ask for.
export const TIME_LIMIT_MS_MIN = 100;
export const TIME_LIMIT_MS_MAX = 10_000;
export const MEMORY_LIMIT_MB_MIN = 32;
export const MEMORY_LIMIT_MB_MAX = 512;
export const OUTPUT_LIMIT_KB_MIN = 1;
export const OUTPUT_LIMIT_KB_MAX = 1024;

// Publishing floor.
export const MIN_PUBLIC_TESTS = 1;
export const MIN_HIDDEN_TESTS = 3;

/** Max size of an uploaded challenge .json file. */
export const MAX_IMPORT_BYTES = 512 * 1024;
/** Version stamp written into (and required by) the import/export format. */
export const CHALLENGE_EXPORT_VERSION = 1;

/**
 * Value types an admin may declare for a parameter or return value. Deliberately
 * a small closed list of JSON-compatible shapes rather than a runtime type
 * system - the runner only uses them for reporting and starter-code hints.
 */
export const SUPPORTED_VALUE_TYPES = [
  'number',
  'string',
  'boolean',
  'null',
  'number[]',
  'string[]',
  'boolean[]',
  'array',
  'object',
  'any',
] as const;

export type SupportedValueType = (typeof SUPPORTED_VALUE_TYPES)[number];

/**
 * Parameter names that are never accepted. Reserved words would produce
 * uncompilable starter code; the rest are object keys that can reach an
 * unexpected slot on the input object the runner builds arguments from.
 */
export const FORBIDDEN_PARAMETER_NAMES = new Set([
  // reserved words / future reserved words
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'implements', 'import', 'in',
  'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private',
  'protected', 'public', 'return', 'static', 'super', 'switch', 'this',
  'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'await', 'async',
  // prototype-pollution vectors and sandbox globals
  '__proto__', 'constructor', 'prototype', 'eval', 'arguments', 'require',
  'process', 'module', 'exports', 'globalThis', 'global',
]);

/** Object keys rejected anywhere inside imported/AI-supplied JSON values. */
export const FORBIDDEN_JSON_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
