import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateRoomDto {
  /** Battles are 1v1: a private room always seats exactly two players. */
  @IsOptional()
  @IsIn([2], { message: 'Private rooms are 1v1: maxPlayers must be 2.' })
  maxPlayers?: number = 2;

  @IsOptional()
  @IsString()
  @Length(4, 32)
  code?: string;
}
