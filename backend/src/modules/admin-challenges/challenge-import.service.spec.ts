import { ChallengeImportService } from './challenge-import.service';
import {
  ImportFileTooLargeException,
  ImportInvalidJsonException,
} from '../../common/exceptions/app.exception';
import { MAX_IMPORT_BYTES } from '../challenges/challenge.constants';

const VALID = {
  version: 1,
  title: 'Two Sum',
  slug: 'two-sum',
  description: 'Return the indices of the two numbers that add up to target.',
  difficulty: 'EASY',
  problemType: 'FUNCTION',
  tags: ['array', 'hash-map'],
  function: {
    name: 'solve',
    parameters: [
      { name: 'nums', type: 'number[]' },
      { name: 'target', type: 'number' },
    ],
    returnType: 'number[]',
    starterCode: 'function solve(nums, target) {}',
  },
  judge: {
    method: 'DEEP_EQUAL',
    referenceSolutionCode: null,
    customCheckerCode: null,
    testGeneratorCode: null,
  },
  limits: { timeLimitMs: 2000, memoryLimitMb: 128, outputLimitKb: 64 },
  tests: [
    { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], hidden: false },
    { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], hidden: true },
  ],
};

describe('ChallengeImportService', () => {
  const service = new ChallengeImportService();
  const parse = (doc: unknown, extra: Record<string, string> = {}) =>
    service.parse({ content: JSON.stringify(doc), ...extra } as never);

  it('maps a valid document onto a draft DTO', () => {
    const dto = parse(VALID);

    expect(dto.title).toBe('Two Sum');
    expect(dto.slug).toBe('two-sum');
    expect(dto.difficulty).toBe('EASY');
    expect(dto.judgeMethod).toBe('DEEP_EQUAL');
    expect(dto.functionContract?.functionName).toBe('solve');
    expect(dto.functionContract?.parameters).toHaveLength(2);
    expect(dto.testCases).toHaveLength(2);
    expect(dto.testCases?.[0]).toMatchObject({ isHidden: false });
    expect(dto.testCases?.[1]).toMatchObject({ isHidden: true });
    expect(dto.timeLimitMs).toBe(2000);
  });

  it('never carries a status or an id through, so an import cannot publish itself', () => {
    const dto = parse({
      ...VALID,
      id: 'attacker-chosen-id',
      status: 'PUBLISHED',
      validationStatus: 'PASSED',
      createdById: 'someone-else',
    });

    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('validationStatus');
    expect(dto).not.toHaveProperty('createdById');
  });

  it('rejects malformed JSON', () => {
    expect(() => service.parse({ content: '{ not json' } as never)).toThrow(
      ImportInvalidJsonException,
    );
  });

  it('rejects an empty file', () => {
    expect(() => service.parse({ content: '' } as never)).toThrow(
      ImportInvalidJsonException,
    );
  });

  it('rejects a document that is not an object', () => {
    expect(() => parse([VALID])).toThrow(ImportInvalidJsonException);
  });

  it('rejects an oversized file', () => {
    const huge = 'x'.repeat(MAX_IMPORT_BYTES + 1);
    expect(() => service.parse({ content: huge } as never)).toThrow(
      ImportFileTooLargeException,
    );
  });

  it('rejects a non-.json file name', () => {
    expect(() => parse(VALID, { fileName: 'challenge.js' })).toThrow(
      ImportInvalidJsonException,
    );
    expect(() => parse(VALID, { fileName: 'challenge.json' })).not.toThrow();
  });

  it('rejects an unexpected MIME type', () => {
    expect(() => parse(VALID, { mimeType: 'application/x-msdownload' })).toThrow(
      ImportInvalidJsonException,
    );
    expect(() => parse(VALID, { mimeType: 'application/json' })).not.toThrow();
  });

  it('rejects an unknown format version', () => {
    expect(() => parse({ ...VALID, version: 99 })).toThrow(/Unsupported challenge format/);
  });

  it('rejects prototype-pollution keys inside test data', () => {
    // Built as raw text so the hostile key survives to JSON.parse, which - unlike
    // an object literal - really does create __proto__ as an own property.
    const hostile = JSON.stringify(VALID).replace(
      '"tests":[',
      '"tests":[{"input":{"__proto__":{"isAdmin":true}},"expectedOutput":1,"hidden":true},',
    );

    expect(() => service.parse({ content: hostile } as never)).toThrow(
      ImportInvalidJsonException,
    );
    expect(() => service.parse({ content: hostile } as never)).toThrow(
      /forbidden key/,
    );
  });

  it('rejects a constructor key nested inside an expected output', () => {
    const hostile = JSON.stringify(VALID).replace(
      '"expectedOutput":[0,1]',
      '"expectedOutput":{"constructor":{"x":1}}',
    );
    expect(() => service.parse({ content: hostile } as never)).toThrow(
      /forbidden key/,
    );
  });

  it('rejects out-of-range execution limits', () => {
    expect(() =>
      parse({ ...VALID, limits: { ...VALID.limits, timeLimitMs: 60_000 } }),
    ).toThrow(/limits.timeLimitMs/);
    expect(() =>
      parse({ ...VALID, limits: { ...VALID.limits, memoryLimitMb: 4096 } }),
    ).toThrow(/limits.memoryLimitMb/);
  });

  it('rejects missing required fields', () => {
    const { title, ...noTitle } = VALID;
    expect(() => parse(noTitle)).toThrow(/"title"/);

    const { function: _fn, ...noFunction } = VALID;
    expect(() => parse(noFunction)).toThrow(/"function"/);

    const { tests: _tests, ...noTests } = VALID;
    expect(() => parse(noTests)).toThrow(/"tests"/);
  });

  it('rejects a non-FUNCTION problem type', () => {
    expect(() => parse({ ...VALID, problemType: 'STANDARD_IO' })).toThrow(
      /Only "FUNCTION"/,
    );
  });

  it('rejects an unknown difficulty or judge method', () => {
    expect(() => parse({ ...VALID, difficulty: 'IMPOSSIBLE' })).toThrow(/"difficulty"/);
    expect(() => parse({ ...VALID, judge: { method: 'VIBES' } })).toThrow(
      /"judge.method"/,
    );
  });

  it('defaults a test with no visibility flag to hidden', () => {
    const dto = parse({
      ...VALID,
      tests: [{ input: { nums: [1], target: 1 }, expectedOutput: [] }],
    });
    expect(dto.testCases?.[0].isHidden).toBe(true);
  });

  it('produces a template that survives its own importer', () => {
    const template = service.buildTemplate();
    const dto = parse(template);
    expect(dto.title).toBe(template.title);
    expect(dto.testCases).toHaveLength(template.tests.length);
  });
});
