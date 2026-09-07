import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateInvitationDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 30, {
    message: 'username must be between 3 and 30 characters',
  })
  username: string;
}
