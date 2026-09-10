import {
  buildStarterCode,
  isValidJsIdentifier,
  isValidSlug,
  sanitizeJsonValue,
  slugify,
  validateFunctionContract,
  validateTestCaseInput,
} from './function-contract.util';
import type { FunctionParameter } from './challenge.types';

describe('function contract validation', () => {
  describe('isValidJsIdentifier', () => {
    it('accepts ordinary identifiers', () => {
      expect(isValidJsIdentifier('nums')).toBe(true);
      expect(isValidJsIdentifier('_target')).toBe(true);
      expect(isValidJsIdentifier('$a1')).toBe(true);
    });

    it('rejects names that would not compile', () => {
      expect(isValidJsIdentifier('1nums')).toBe(false);
      expect(isValidJsIdentifier('my param')).toBe(false);
      expect(isValidJsIdentifier('nums-target')).toBe(false);
      expect(isValidJsIdentifier('')).toBe(false);
      expect(isValidJsIdentifier(42)).toBe(false);
    });

    it('rejects reserved words and prototype-pollution vectors', () => {
      for (const name of [
        'class',
        'return',
        'await',
        '__proto__',
        'constructor',
        'prototype',
        'eval',
        'process',
        'require',
        'globalThis',
      ]) {
        expect(isValidJsIdentifier(name)).toBe(false);
      }
    });
  });

  describe('validateFunctionContract', () => {
    const valid = {
      functionName: 'solve',
      parameters: [
        { name: 'nums', type: 'number[]' },
        { name: 'target', type: 'number' },
      ] as FunctionParameter[],
      returnType: 'number[]',
    };

    it('accepts a well-formed contract', () => {
      expect(validateFunctionContract(valid)).toEqual([]);
    });

    it('rejects an invalid function name', () => {
      const errors = validateFunctionContract({ ...valid, functionName: 'my fn' });
      expect(errors.join(' ')).toMatch(/Function name/);
    });

    it('rejects a dangerous parameter name', () => {
      const errors = validateFunctionContract({
        ...valid,
        parameters: [{ name: '__proto__', type: 'number' }] as FunctionParameter[],
      });
      expect(errors.join(' ')).toMatch(/__proto__/);
    });

    it('rejects duplicate parameter names', () => {
      const errors = validateFunctionContract({
        ...valid,
        parameters: [
          { name: 'nums', type: 'number[]' },
          { name: 'nums', type: 'number' },
        ] as FunctionParameter[],
      });
      expect(errors.join(' ')).toMatch(/duplicate/i);
    });

    it('rejects an unsupported value type', () => {
      const errors = validateFunctionContract({
        ...valid,
        parameters: [{ name: 'nums', type: 'Map<string,number>' }] as never,
      });
      expect(errors.join(' ')).toMatch(/not a supported value type/);
    });

    it('rejects an unsupported return type', () => {
      const errors = validateFunctionContract({ ...valid, returnType: 'Promise' });
      expect(errors.join(' ')).toMatch(/not a supported return type/);
    });
  });

  describe('validateTestCaseInput', () => {
    const parameters = [
      { name: 'nums', type: 'number[]' },
      { name: 'target', type: 'number' },
    ] as FunctionParameter[];

    it('accepts an object with exactly the declared parameters', () => {
      expect(
        validateTestCaseInput({ nums: [1, 2], target: 3 }, parameters),
      ).toEqual([]);
    });

    it('rejects a non-object input', () => {
      expect(validateTestCaseInput([1, 2], parameters).join(' ')).toMatch(
        /must be a JSON object/,
      );
    });

    it('reports a missing parameter', () => {
      expect(validateTestCaseInput({ nums: [1] }, parameters).join(' ')).toMatch(
        /missing a value for parameter "target"/,
      );
    });

    it('reports an unknown key', () => {
      expect(
        validateTestCaseInput({ nums: [1], target: 2, extra: 3 }, parameters).join(' '),
      ).toMatch(/no matching parameter for key "extra"/);
    });
  });

  describe('sanitizeJsonValue', () => {
    it('returns a structural copy of plain JSON', () => {
      const input = { nums: [1, 2, { deep: true }], label: 'x', empty: null };
      expect(sanitizeJsonValue(input)).toEqual(input);
    });

    it('rejects prototype-pollution keys', () => {
      const hostile = JSON.parse('{"__proto__": {"isAdmin": true}}');
      expect(() => sanitizeJsonValue(hostile)).toThrow(/forbidden key/);
      expect(() => sanitizeJsonValue({ nested: { constructor: 1 } })).toThrow(
        /forbidden key/,
      );
    });

    it('rejects excessive nesting', () => {
      let deep: unknown = 1;
      for (let i = 0; i < 20; i++) deep = { deep };
      expect(() => sanitizeJsonValue(deep)).toThrow(/nests deeper/);
    });

    it('rejects values JSON cannot represent', () => {
      expect(() => sanitizeJsonValue({ n: NaN })).toThrow(/NaN or Infinity/);
      expect(() => sanitizeJsonValue({ f: () => 1 })).toThrow(/Unsupported JSON value/);
    });
  });

  describe('slugs and starter code', () => {
    it('slugifies titles', () => {
      expect(slugify('Two Sum')).toBe('two-sum');
      expect(slugify('  Hello, World!  ')).toBe('hello-world');
    });

    it('validates slug shape', () => {
      expect(isValidSlug('two-sum')).toBe(true);
      expect(isValidSlug('Two-Sum')).toBe(false);
      expect(isValidSlug('two--sum')).toBe(false);
      expect(isValidSlug('-two')).toBe(false);
    });

    it('builds starter code from the contract', () => {
      expect(
        buildStarterCode({
          functionName: 'solve',
          parameters: [
            { name: 'nums', type: 'number[]' },
            { name: 'target', type: 'number' },
          ],
          returnType: 'number[]',
        }),
      ).toContain('function solve(nums, target) {');
    });
  });
});
