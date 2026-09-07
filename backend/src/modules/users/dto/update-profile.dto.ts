import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 50, {
    message: 'displayName must be between 1 and 50 characters',
  })
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

  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  @MaxLength(500, { message: 'avatarUrl must be at most 500 characters' })
  avatarUrl?: string;

  @IsOptional()
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
