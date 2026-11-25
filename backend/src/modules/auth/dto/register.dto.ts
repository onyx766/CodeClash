import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Letters, digits, underscores and hyphens: usernames appear in URLs
 * (/users/:username/profile) and in the UI. `me` is reserved because
 * /users/me/profile is the caller's own profile.
 */
export const USERNAME_PATTERN = /^(?!me$)[A-Za-z0-9_-]+$/i;

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(3, 30, {
    message: 'username must be between 3 and 30 characters',
  })
  @Matches(USERNAME_PATTERN, {
    message: 'username may only contain letters, numbers, underscores and hyphens',
  })
  username: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  // argon2 hashes the whole input; an unbounded password is a cheap way to
  // burn server CPU.
  @MaxLength(128, { message: 'password must be at most 128 characters' })
  password: string;
}
