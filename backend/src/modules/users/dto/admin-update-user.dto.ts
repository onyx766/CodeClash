import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Admin edit of another account's details.
 *
 * Deliberately excludes `role` (MASTER-only, its own endpoint), `status` (ban /
 * unban endpoints) and anything competitive - rating, wins, coins, xp. Those
 * are derived from match results; letting an admin type a rating would bypass
 * the anti-rigging rules RatingService enforces and desync RatingHistory.
 *
 * Profile fields mirror UpdateProfileDto's limits so an admin cannot store
 * something the owner's own profile editor would have refused. An empty string
 * clears an optional profile field.
 */
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  // Same rule as RegisterDto - stricter here would make it impossible to save
  // an account whose existing username registration accepted.
  @Length(3, 30, { message: 'username must be between 3 and 30 characters' })
  username?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @MaxLength(50, { message: 'displayName must be at most 50 characters' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @MaxLength(300, { message: 'bio must be at most 300 characters' })
  bio?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @MaxLength(100, { message: 'location must be at most 100 characters' })
  location?: string;

  /** Empty string clears it; anything else must be a real URL. */
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  @MaxLength(500, { message: 'avatarUrl must be at most 500 characters' })
  avatarUrl?: string;

  // Normally derived from IP geolocation - editable here so an admin can
  // correct a bad lookup. Same "empty string clears it" convention as the
  // profile fields above.
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @MaxLength(100, { message: 'country must be at most 100 characters' })
  country?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @MaxLength(100, { message: 'region must be at most 100 characters' })
  region?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @MaxLength(100, { message: 'city must be at most 100 characters' })
  city?: string;
}

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(200)
  password: string;
}
