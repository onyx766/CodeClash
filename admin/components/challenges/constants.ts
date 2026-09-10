/** Mirrors backend/src/modules/challenges/challenge.constants.ts. */
export const DESCRIPTION_MAX = 20_000;
export const MAX_PARAMETERS = 8;
export const MAX_TAGS = 10;
export const MAX_TEST_CASES = 200;
/** Matches MAX_IMPORT_BYTES on the server, which rejects anything larger. */
export const MAX_IMPORT_BYTES = 512 * 1024;
