import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRoomDto } from './create-room.dto';

describe('CreateRoomDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(CreateRoomDto, { maxPlayers: 2, code: 'ABCD' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([1, 3, 4])('rejects maxPlayers=%p - battles are 1v1', async (maxPlayers) => {
    const dto = plainToInstance(CreateRoomDto, { maxPlayers });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('maxPlayers');
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
