import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvitationDto } from './create-invitation.dto';

describe('CreateInvitationDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(CreateInvitationDto, { username: 'friend' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing username', async () => {
    const dto = plainToInstance(CreateInvitationDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a too-short username', async () => {
    const dto = plainToInstance(CreateInvitationDto, { username: 'ab' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('strips a client-supplied `roomId` field under whitelist validation', async () => {
    const dto = plainToInstance(CreateInvitationDto, { username: 'friend', roomId: 'room-1' });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('roomId');
  });
});
