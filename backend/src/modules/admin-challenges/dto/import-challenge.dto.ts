import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_IMPORT_BYTES } from '../../challenges/challenge.constants';

/**
 * JSON import arrives as a string rather than a parsed object so the size and
 * the parse itself can be policed before anything is interpreted. The admin UI
 * reads the file client-side and posts its text here; the server never trusts
 * the client's own parse.
 */
export class ImportChallengeDto {
  @IsString()
  @MaxLength(MAX_IMPORT_BYTES, {
    message: 'The uploaded challenge file is too large.',
  })
  content: string;

  /** Original file name, used only to check the extension. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  /** Browser-reported MIME type, checked when present. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  mimeType?: string;
}
