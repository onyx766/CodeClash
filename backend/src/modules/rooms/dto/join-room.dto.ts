import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class JoinRoomDto {
  @IsString()
  @Length(4, 32)
  @Transform(({ value }: { value: string }) => value?.toUpperCase().trim())
  code!: string;
}
