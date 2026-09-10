import {
  FORBIDDEN_JSON_KEYS,
  FORBIDDEN_PARAMETER_NAMES,
  FUNCTION_NAME_MAX_LENGTH,
  MAX_JSON_DEPTH,
  MAX_PARAMETERS,
  PARAMETER_NAME_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  SUPPORTED_VALUE_TYPES,
  SupportedValueType,
} from './challenge.constants';
import type { FunctionContract, FunctionParameter, JsonValue } from './challenge.types';

/**
 * Static validation of everything the browser can put in a function contract.
 *
 * Nothing here executes, parses or compiles code - these are string and shape
 * checks only. Actual syntax checking of starter/reference/checker code happens
 * inside the isolated runner (see ChallengeValidationService).
 */

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function isValidJsIdentifier(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    IDENTIFIER_PATTERN.test(name) &&
    !FORBIDDEN_PARAMETER_NAMES.has(name)
  );
}

export function isSupportedValueType(
  type: unknown,
): type is SupportedValueType {
  return (
    typeof type === 'string' &&
    (SUPPORTED_VALUE_TYPES as readonly string[]).includes(type)
  );
}

export function isValidSlug(slug: unknown): slug is string {
  return (
    typeof slug === 'string' &&
    slug.length <= SLUG_MAX_LENGTH &&
    SLUG_PATTERN.test(slug)
  );
}

export function slugify(input: string): string {
  return input
    // Decompose accents so "Résumé" slugs as "resume" rather than "r-sum".
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * Validates a function contract. Returns the list of problems; empty means the
 * contract is usable.
 */
export function validateFunctionContract(
  contract: Partial<FunctionContract> | null | undefined,
): string[] {
  const errors: string[] = [];
  if (!contract || typeof contract !== 'object') {
    return ['A function contract is required.'];
  }

  const { functionName, parameters, returnType } = contract;

  if (!isValidJsIdentifier(functionName)) {
    errors.push(
      'Function name must be a valid JavaScript identifier and not a reserved word.',
    );
  } else if (functionName.length > FUNCTION_NAME_MAX_LENGTH) {
    errors.push(
      `Function name must be at most ${FUNCTION_NAME_MAX_LENGTH} characters.`,
    );
  }

  if (!Array.isArray(parameters)) {
    errors.push('Parameters must be a list.');
    return errors;
  }
  if (parameters.length > MAX_PARAMETERS) {
    errors.push(`A function may declare at most ${MAX_PARAMETERS} parameters.`);
  }

  const seen = new Set<string>();
  parameters.forEach((parameter: FunctionParameter, index: number) => {
    const label = `Parameter ${index + 1}`;
    if (!parameter || typeof parameter !== 'object') {
      errors.push(`${label} is malformed.`);
      return;
    }
    if (!isValidJsIdentifier(parameter.name)) {
      errors.push(
        `${label}: "${String(parameter.name)}" is not a valid JavaScript identifier (or is a reserved name).`,
      );
    } else if (parameter.name.length > PARAMETER_NAME_MAX_LENGTH) {
      errors.push(
        `${label} name must be at most ${PARAMETER_NAME_MAX_LENGTH} characters.`,
      );
    } else if (seen.has(parameter.name)) {
      errors.push(`${label}: duplicate parameter name "${parameter.name}".`);
    } else {
      seen.add(parameter.name);
    }
    if (!isSupportedValueType(parameter.type)) {
      errors.push(
        `${label}: "${String(parameter.type)}" is not a supported value type.`,
      );
    }
  });

  if (!isSupportedValueType(returnType)) {
    errors.push(`"${String(returnType)}" is not a supported return type.`);
  }

  return errors;
}

/**
 * A test case input is an object keyed by the contract's parameter names. Every
 * declared parameter must be present; unknown keys are rejected rather than
 * silently ignored so a renamed parameter surfaces as an error instead of an
 * `undefined` argument at judging time.
 */
export function validateTestCaseInput(
  input: unknown,
  parameters: FunctionParameter[],
): string[] {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return [
      'Input must be a JSON object keyed by parameter name, e.g. { "nums": [1,2], "target": 3 }.',
    ];
  }

  const errors: string[] = [];
  const keys = Object.keys(input as Record<string, unknown>);

  for (const key of keys) {
    if (FORBIDDEN_JSON_KEYS.has(key)) {
      errors.push(`Input contains a forbidden key "${key}".`);
    }
  }

  const declared = new Set(parameters.map((p) => p.name));
  for (const parameter of parameters) {
    if (!(parameter.name in (input as Record<string, unknown>))) {
      errors.push(`Input is missing a value for parameter "${parameter.name}".`);
    }
  }
  for (const key of keys) {
    if (!declared.has(key) && !FORBIDDEN_JSON_KEYS.has(key)) {
      errors.push(`Input has no matching parameter for key "${key}".`);
    }
  }

  return errors;
}

/**
 * Recursively verifies a value is plain JSON, is not too deep and carries no
 * prototype-pollution keys, then returns a structurally fresh copy. Use on
 * anything that arrives from a browser, an import file or the AI provider
 * before it goes near Prisma.
 */
export function sanitizeJsonValue(value: unknown, depth = 0): JsonValue {
  if (depth > MAX_JSON_DEPTH) {
    throw new Error(`JSON value nests deeper than ${MAX_JSON_DEPTH} levels.`);
  }
  if (value === null) return null;

  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value as JsonValue;
  if (type === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error('JSON values may not contain NaN or Infinity.');
    }
    return value as number;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry, depth + 1));
  }
  if (type === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, JsonValue> = Object.create(null) as Record<
      string,
      JsonValue
    >;
    for (const key of Object.keys(source)) {
      if (FORBIDDEN_JSON_KEYS.has(key)) {
        throw new Error(`JSON value contains a forbidden key "${key}".`);
      }
      result[key] = sanitizeJsonValue(source[key], depth + 1);
    }
    // Back to an ordinary object literal so Prisma serialises it as JSON.
    return { ...result };
  }

  throw new Error(`Unsupported JSON value of type "${type}".`);
}

/** Convenience starter code for a contract, used by the admin UI and importer. */
export function buildStarterCode(contract: FunctionContract): string {
  const args = contract.parameters.map((p) => p.name).join(', ');
  return `function ${contract.functionName}(${args}) {\n  // Write your solution here\n}\n`;
}
