import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FUNCTION_NAME_MAX_LENGTH,
  MAX_CODE_LENGTH,
  MAX_PARAMETERS,
  MAX_TEST_CASES,
  MEMORY_LIMIT_MB_MAX,
  MEMORY_LIMIT_MB_MIN,
  OUTPUT_LIMIT_KB_MAX,
  OUTPUT_LIMIT_KB_MIN,
  PARAMETER_NAME_MAX_LENGTH,
  SUPPORTED_VALUE_TYPES,
  TIME_LIMIT_MS_MAX,
  TIME_LIMIT_MS_MIN,
} from '../../challenges/challenge.constants';

/**
 * Shape-level validation only. Semantic rules that need the whole challenge
 * (identifier legality, inputs matching the declared parameters, judge method
 * requiring checker code, ...) live in AdminChallengesService so the importer
 * and the AI path get exactly the same treatment.
 */

export class FunctionParameterDto {
  @IsString()
  @MaxLength(PARAMETER_NAME_MAX_LENGTH)
  name: string;

  @IsIn(SUPPORTED_VALUE_TYPES as unknown as string[])
  type: string;
}

export class FunctionContractDto {
  @IsString()
  @MaxLength(FUNCTION_NAME_MAX_LENGTH)
  functionName: string;

  @IsArray()
  @ArrayMaxSize(MAX_PARAMETERS)
  @ValidateNested({ each: true })
  @Type(() => FunctionParameterDto)
  parameters: FunctionParameterDto[];

  @IsIn(SUPPORTED_VALUE_TYPES as unknown as string[])
  returnType: string;

  @IsString()
  @MaxLength(MAX_CODE_LENGTH)
  starterCode: string;
}

export class TestCaseDto {
  /**
   * A JSON object keyed by parameter name. Typed as unknown on purpose: it is
   * run through sanitizeJsonValue() and checked against the function contract
   * in the service rather than being trusted here.
   */
  @IsDefined()
  input: unknown;

  @IsOptional()
  expectedOutput?: unknown;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}

export class ExecutionLimitsDto {
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
}

export class TestCaseListDto {
  @IsArray()
  @ArrayMaxSize(MAX_TEST_CASES)
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases: TestCaseDto[];
}
