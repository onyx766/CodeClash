import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsHttpUrl } from '../../../common/decorators/is-http-url.decorator';

/**
 * The optional text fields' input rule: trimmed, and null, '' or
 * whitespace-only means "clear it" (stored as null). An omitted field never
 * reaches this and stays unchanged. Non-strings pass through for the
 * validators to reject.
 */
const trimOrClear = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/** Same for the lists: null clears one (an empty list, never a null). */
const emptyIfNull = ({ value }: { value: unknown }) =>
  value === null ? [] : value;

/**
 * PATCH /users/me/profile. Every field is optional: omitted fields keep their
 * value, a text field sent as null or an empty string is cleared, and a list
 * sent as null is emptied.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Transform(trimOrClear)
  @Length(1, 50, {
    message: 'displayName must be between 1 and 50 characters',
  })
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOrClear)
  @MaxLength(300, { message: 'bio must be at most 300 characters' })
  bio?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOrClear)
  @MaxLength(100, { message: 'location must be at most 100 characters' })
  location?: string | null;

  /** Shown to other players as an image, so only absolute web links. */
  @IsOptional()
  @Transform(trimOrClear)
  @IsHttpUrl({
    message: 'avatarUrl must be an absolute http:// or https:// URL',
  })
  @MaxLength(500, { message: 'avatarUrl must be at most 500 characters' })
  avatarUrl?: string | null;

  @IsOptional()
  @Transform(emptyIfNull)
  @IsArray()
  @ArrayMaxSize(5, {
    message: 'favoriteLanguages can contain at most 5 items',
  })
  @ArrayUnique({ message: 'favoriteLanguages must not contain duplicates' })
  @IsString({ each: true })
  @MaxLength(30, {
    each: true,
    message: 'each favorite language must be at most 30 characters',
  })
  favoriteLanguages?: string[];

  @IsOptional()
  @Transform(emptyIfNull)
  @IsArray()
  @ArrayMaxSize(10, { message: 'favoriteTopics can contain at most 10 items' })
  @ArrayUnique({ message: 'favoriteTopics must not contain duplicates' })
  @IsString({ each: true })
  @MaxLength(50, {
    each: true,
    message: 'each favorite topic must be at most 50 characters',
  })
  favoriteTopics?: string[];
}
