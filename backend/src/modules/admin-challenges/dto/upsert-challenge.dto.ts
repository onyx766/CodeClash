import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChallengeProblemType, Difficulty, JudgeMethod } from '@prisma/client';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  MAX_CODE_LENGTH,
  MAX_TAGS,
  MAX_TEST_CASES,
  MEMORY_LIMIT_MB_MAX,
  MEMORY_LIMIT_MB_MIN,
  OUTPUT_LIMIT_KB_MAX,
  OUTPUT_LIMIT_KB_MIN,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
  TAG_MAX_LENGTH,
  TIME_LIMIT_MS_MAX,
  TIME_LIMIT_MS_MIN,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '../../challenges/challenge.constants';
import { FunctionContractDto, TestCaseDto } from './challenge-parts.dto';

/**
 * Payload for POST /api/admin/challenges and PATCH /api/admin/challenges/:id.
 *
 * Note what is NOT here: `status`, `publishedAt`, `validationStatus` and
 * `createdById`. Lifecycle transitions have their own endpoints, and the global
 * ValidationPipe runs with `whitelist: true`, so a client that posts
 * `{"status":"PUBLISHED"}` simply has that field dropped.
 */
export class UpsertChallengeDto {
  @IsOptional()
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(SLUG_MIN_LENGTH)
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase letters, numbers and single hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(DESCRIPTION_MIN_LENGTH)
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsEnum(ChallengeProblemType)
  problemType?: ChallengeProblemType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  tags?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FunctionContractDto)
  functionContract?: FunctionContractDto;

  @IsOptional()
  @IsEnum(JudgeMethod)
  judgeMethod?: JudgeMethod;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CODE_LENGTH)
  referenceSolutionCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CODE_LENGTH)
  customCheckerCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CODE_LENGTH)
  testGeneratorCode?: string | null;

  @IsOptional()
  @IsInt()
  @Min(TIME_LIMIT_MS_MIN)
  @Max(TIME_LIMIT_MS_MAX)
  timeLimitMs?: number;

  @IsOptional()
  @IsInt()
  @Min(MEMORY_LIMIT_MB_MIN)
  @Max(MEMORY_LIMIT_MB_MAX)
  memoryLimitMb?: number;

  @IsOptional()
  @IsInt()
  @Min(OUTPUT_LIMIT_KB_MIN)
  @Max(OUTPUT_LIMIT_KB_MAX)
  outputLimitKb?: number;

  /** Round duration in seconds - not an execution limit. */
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  timeLimitSeconds?: number;

  /**
   * When present, replaces the whole test-case set. Omit it to leave the
   * existing tests untouched.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TEST_CASES)
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases?: TestCaseDto[];
}
