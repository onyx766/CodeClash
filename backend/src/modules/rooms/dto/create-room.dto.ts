import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateRoomDto {
  @IsOptional()
  @IsInt()
  maxPlayers?: number = 2;

  @IsOptional()
  @IsString()
  @Length(4, 32)
  code?: string;
}
