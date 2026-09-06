import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 30, {
    message: 'username must be between 3 and 30 characters',
  })
  username: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;
}
