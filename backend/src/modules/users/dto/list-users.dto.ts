import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Role, UserStatus } from '@prisma/client';

/** Relative windows offered by the "All Join Dates" filter. */
export const JOIN_WINDOWS = ['24h', '7d', '30d', '90d', '1y'] as const;
export type JoinWindow = (typeof JOIN_WINDOWS)[number];

export const USER_SORT_FIELDS = [
  'createdAt',
  'lastActiveAt',
  'username',
  'rating',
] as const;

export class ListUsersDto {
  /** Matches username, email or exact id. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsIn(JOIN_WINDOWS as unknown as string[])
  joinedWithin?: JoinWindow;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(USER_SORT_FIELDS as unknown as string[])
  sortBy?: (typeof USER_SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
