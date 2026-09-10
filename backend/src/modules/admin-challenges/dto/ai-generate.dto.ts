import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Difficulty } from '@prisma/client';
import { MAX_TAGS, TAG_MAX_LENGTH } from '../../challenges/challenge.constants';

export class AiGenerateChallengeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  topic: string;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  concept?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  publicTestCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  hiddenTestCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}
