import { IsEmail, IsNotEmpty, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @Length(3, 32)
  username: string;

  @IsNotEmpty()
  @Length(6, 128)
  password: string;
}
