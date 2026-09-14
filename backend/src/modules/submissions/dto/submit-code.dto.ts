import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const MAX_SOURCE_CODE_LENGTH = 64 * 1024;

/**
 * The whole request body for Run Tests and Submit. The global ValidationPipe
 * runs with whitelist: true, so anything else a client sends (solved,
 * winnerId, score, passedTests...) is stripped before it reaches a service.
 */
export class SubmitCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SOURCE_CODE_LENGTH)
  code!: string;

  /** Only JavaScript is judged today. */
  @IsOptional()
  @IsIn(['javascript'])
  language?: 'javascript';
}
