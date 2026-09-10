import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class BanUserDto {
  /** Shown to the banned account and kept on the record for the audit trail. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * Admin-created account. `role` is optional and capped by the actor's own rank
 * in AdminUsersService - an ADMIN can never mint a MASTER.
 */
export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 30, { message: 'username must be between 3 and 30 characters' })
  username: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @IsEnum(Role, { message: 'role must be one of USER, ADMIN, MASTER' })
  role?: Role;
}
