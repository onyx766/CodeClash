import { Injectable } from '@nestjs/common';
import { ChallengeCreationMode, Difficulty, JudgeMethod } from '@prisma/client';
import {
  ImportFileTooLargeException,
  ImportInvalidJsonException,
} from '../../common/exceptions/app.exception';
import {
  CHALLENGE_EXPORT_VERSION,
  DESCRIPTION_MAX_LENGTH,
  MAX_CODE_LENGTH,
  MAX_IMPORT_BYTES,
  MAX_TAGS,
  MAX_TEST_CASES,
  MEMORY_LIMIT_MB_MAX,
  MEMORY_LIMIT_MB_MIN,
  OUTPUT_LIMIT_KB_MAX,
  OUTPUT_LIMIT_KB_MIN,
  TAG_MAX_LENGTH,
  TIME_LIMIT_MS_MAX,
  TIME_LIMIT_MS_MIN,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '../challenges/challenge.constants';
import {
  buildStarterCode,
  sanitizeJsonValue,
  slugify,
} from '../challenges/function-contract.util';
import type { FunctionParameter } from '../challenges/challenge.types';
import type { UpsertChallengeDto } from './dto/upsert-challenge.dto';
import type { ImportChallengeDto } from './dto/import-challenge.dto';

const ALLOWED_MIME_TYPES = new Set([
  'application/json',
  'text/json',
  'application/x-json',
  'text/plain',
  '',
]);

/**
 * Turns an uploaded .json file into a validated UpsertChallengeDto.
 *
 * Imported JSON is untrusted input. It is size-capped, parsed here rather than
 * trusted from the client, and then mapped field by field - never handed to
 * Prisma wholesale. Unknown properties are dropped, prototype-pollution keys
 * are rejected by sanitizeJsonValue(), and the result is a DRAFT like any other
 * creation mode.
 */
@Injectable()
export class ChallengeImportService {
  readonly creationMode = ChallengeCreationMode.JSON_IMPORT;

  parse(dto: ImportChallengeDto): UpsertChallengeDto {
    const byteLength = Buffer.byteLength(dto.content ?? '', 'utf8');
    if (byteLength > MAX_IMPORT_BYTES) {
      throw new ImportFileTooLargeException(
        `Challenge files must be ${Math.floor(MAX_IMPORT_BYTES / 1024)} KB or smaller.`,
      );
    }
    if (byteLength === 0) {
      throw new ImportInvalidJsonException('The uploaded file is empty.');
    }
    if (dto.fileName && !/\.json$/i.test(dto.fileName)) {
      throw new ImportInvalidJsonException('Only .json files can be imported.');
    }
    if (
      dto.mimeType !== undefined &&
      !ALLOWED_MIME_TYPES.has(dto.mimeType.split(';')[0].trim().toLowerCase())
    ) {
      throw new ImportInvalidJsonException(
        `Unsupported file type "${dto.mimeType}". Upload a JSON file.`,
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(dto.content);
    } catch (error) {
      throw new ImportInvalidJsonException(
        `The file is not valid JSON: ${(error as Error).message}`,
      );
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ImportInvalidJsonException(
        'The file must contain a single challenge object.',
      );
    }

    return this.mapDocument(raw as Record<string, unknown>);
  }

  /** Explicit whitelist mapping - the only place import fields become a DTO. */
  private mapDocument(doc: Record<string, unknown>): UpsertChallengeDto {
    const version = doc.version;
    if (version !== undefined && version !== CHALLENGE_EXPORT_VERSION) {
      throw new ImportInvalidJsonException(
        `Unsupported challenge format version "${String(version)}". Expected ${CHALLENGE_EXPORT_VERSION}.`,
      );
    }

    const title = this.requireString(doc.title, 'title');
    if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
      throw new ImportInvalidJsonException(
        `"title" must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
      );
    }

    const description = this.requireString(doc.description, 'description');
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      throw new ImportInvalidJsonException('"description" is too long.');
    }

    const difficulty = this.enumValue(
      doc.difficulty,
      Difficulty,
      'difficulty',
      Difficulty.EASY,
    );

    const problemType = doc.problemType;
    if (problemType !== undefined && problemType !== 'FUNCTION') {
      throw new ImportInvalidJsonException(
        'Only "FUNCTION" problems can be imported at the moment.',
      );
    }

    const fn = doc.function;
    if (!fn || typeof fn !== 'object' || Array.isArray(fn)) {
      throw new ImportInvalidJsonException('"function" must be an object.');
    }
    const fnDoc = fn as Record<string, unknown>;
    const functionName = this.requireString(fnDoc.name, 'function.name');

    if (!Array.isArray(fnDoc.parameters)) {
      throw new ImportInvalidJsonException('"function.parameters" must be an array.');
    }
    const parameters: FunctionParameter[] = fnDoc.parameters.map(
      (parameter, index) => {
        if (!parameter || typeof parameter !== 'object' || Array.isArray(parameter)) {
          throw new ImportInvalidJsonException(
            `"function.parameters[${index}]" must be an object.`,
          );
        }
        const entry = parameter as Record<string, unknown>;
        return {
          name: this.requireString(entry.name, `function.parameters[${index}].name`),
          type: this.requireString(
            entry.type,
            `function.parameters[${index}].type`,
          ) as FunctionParameter['type'],
        };
      },
    );

    const returnType = this.requireString(fnDoc.returnType, 'function.returnType');
    const starterCode = this.optionalCode(fnDoc.starterCode, 'function.starterCode');

    const judgeDoc = this.objectOrEmpty(doc.judge, 'judge');
    const judgeMethod = this.enumValue(
      judgeDoc.method,
      JudgeMethod,
      'judge.method',
      JudgeMethod.DEEP_EQUAL,
    );

    const limitsDoc = this.objectOrEmpty(doc.limits, 'limits');

    if (!Array.isArray(doc.tests)) {
      throw new ImportInvalidJsonException('"tests" must be an array.');
    }
    if (doc.tests.length > MAX_TEST_CASES) {
      throw new ImportInvalidJsonException(
        `A challenge may not have more than ${MAX_TEST_CASES} test cases.`,
      );
    }

    const testCases = doc.tests.map((test, index) => {
      if (!test || typeof test !== 'object' || Array.isArray(test)) {
        throw new ImportInvalidJsonException(`"tests[${index}]" must be an object.`);
      }
      const entry = test as Record<string, unknown>;
      if (entry.input === undefined) {
        throw new ImportInvalidJsonException(`"tests[${index}].input" is required.`);
      }
      try {
        return {
          input: sanitizeJsonValue(entry.input),
          expectedOutput:
            entry.expectedOutput === undefined || entry.expectedOutput === null
              ? null
              : sanitizeJsonValue(entry.expectedOutput),
          isHidden:
            typeof entry.hidden === 'boolean'
              ? entry.hidden
              : typeof entry.isHidden === 'boolean'
                ? entry.isHidden
                : true,
        };
      } catch (error) {
        throw new ImportInvalidJsonException(
          `"tests[${index}]": ${(error as Error).message}`,
        );
      }
    });

    return {
      title,
      slug: typeof doc.slug === 'string' ? slugify(doc.slug) : slugify(title),
      description,
      difficulty,
      tags: this.tagList(doc.tags),
      functionContract: {
        functionName,
        parameters: parameters as never,
        returnType,
        starterCode:
          starterCode ?? buildStarterCode({ functionName, parameters, returnType }),
      },
      judgeMethod,
      referenceSolutionCode: this.optionalCode(
        judgeDoc.referenceSolutionCode,
        'judge.referenceSolutionCode',
      ),
      customCheckerCode: this.optionalCode(
        judgeDoc.customCheckerCode,
        'judge.customCheckerCode',
      ),
      testGeneratorCode: this.optionalCode(
        judgeDoc.testGeneratorCode,
        'judge.testGeneratorCode',
      ),
      timeLimitMs: this.boundedInt(
        limitsDoc.timeLimitMs,
        TIME_LIMIT_MS_MIN,
        TIME_LIMIT_MS_MAX,
        'limits.timeLimitMs',
      ),
      memoryLimitMb: this.boundedInt(
        limitsDoc.memoryLimitMb,
        MEMORY_LIMIT_MB_MIN,
        MEMORY_LIMIT_MB_MAX,
        'limits.memoryLimitMb',
      ),
      outputLimitKb: this.boundedInt(
        limitsDoc.outputLimitKb,
        OUTPUT_LIMIT_KB_MIN,
        OUTPUT_LIMIT_KB_MAX,
        'limits.outputLimitKb',
      ),
      testCases,
    };
  }

  /** The downloadable starting point offered next to the import button. */
  buildTemplate() {
    return {
      version: CHALLENGE_EXPORT_VERSION,
      title: 'Two Sum',
      slug: 'two-sum',
      description:
        'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.',
      difficulty: Difficulty.EASY,
      problemType: 'FUNCTION',
      tags: ['array', 'hash-map'],
      function: {
        name: 'solve',
        parameters: [
          { name: 'nums', type: 'number[]' },
          { name: 'target', type: 'number' },
        ],
        returnType: 'number[]',
        starterCode:
          'function solve(nums, target) {\n  // Write your solution here\n}\n',
      },
      judge: {
        method: JudgeMethod.DEEP_EQUAL,
        referenceSolutionCode: null,
        customCheckerCode: null,
        testGeneratorCode: null,
      },
      limits: { timeLimitMs: 2000, memoryLimitMb: 128, outputLimitKb: 64 },
      tests: [
        {
          input: { nums: [2, 7, 11, 15], target: 9 },
          expectedOutput: [0, 1],
          hidden: false,
        },
        { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], hidden: true },
        { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], hidden: true },
        { input: { nums: [1, 2], target: 99 }, expectedOutput: [], hidden: true },
      ],
    };
  }

  // -------------------------------------------------------------------------

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ImportInvalidJsonException(`"${field}" must be a non-empty string.`);
    }
    return value;
  }

  private optionalCode(value: unknown, field: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') {
      throw new ImportInvalidJsonException(`"${field}" must be a string.`);
    }
    if (value.length > MAX_CODE_LENGTH) {
      throw new ImportInvalidJsonException(
        `"${field}" exceeds ${MAX_CODE_LENGTH} characters.`,
      );
    }
    return value;
  }

  private objectOrEmpty(value: unknown, field: string): Record<string, unknown> {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new ImportInvalidJsonException(`"${field}" must be an object.`);
    }
    return value as Record<string, unknown>;
  }

  private enumValue<T extends Record<string, string>>(
    value: unknown,
    enumObject: T,
    field: string,
    fallback: T[keyof T],
  ): T[keyof T] {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'string' || !Object.values(enumObject).includes(value)) {
      throw new ImportInvalidJsonException(
        `"${field}" must be one of: ${Object.values(enumObject).join(', ')}.`,
      );
    }
    return value as T[keyof T];
  }

  private boundedInt(
    value: unknown,
    min: number,
    max: number,
    field: string,
  ): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new ImportInvalidJsonException(`"${field}" must be an integer.`);
    }
    if (value < min || value > max) {
      throw new ImportInvalidJsonException(
        `"${field}" must be between ${min} and ${max}.`,
      );
    }
    return value;
  }

  private tagList(value: unknown): string[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) {
      throw new ImportInvalidJsonException('"tags" must be an array of strings.');
    }
    if (value.length > MAX_TAGS) {
      throw new ImportInvalidJsonException(
        `A challenge may not have more than ${MAX_TAGS} tags.`,
      );
    }
    return value.map((tag, index) => {
      if (typeof tag !== 'string' || tag.length > TAG_MAX_LENGTH) {
        throw new ImportInvalidJsonException(
          `"tags[${index}]" must be a string of at most ${TAG_MAX_LENGTH} characters.`,
        );
      }
      return tag;
    });
  }
}
