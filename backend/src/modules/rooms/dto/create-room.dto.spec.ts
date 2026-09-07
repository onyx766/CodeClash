import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRoomDto } from './create-room.dto';

describe('CreateRoomDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(CreateRoomDto, { maxPlayers: 4, code: 'ABCD' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('strips a client-supplied `ranked` field under whitelist validation', async () => {
    const dto = plainToInstance(CreateRoomDto, { maxPlayers: 2, ranked: true });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('ranked');
  });

  it('strips a client-supplied `ratingEligible` field under whitelist validation', async () => {
    const dto = plainToInstance(CreateRoomDto, { maxPlayers: 2, ratingEligible: true });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('ratingEligible');
  });
});
