import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

async function validateRegister(data: Partial<RegisterDto>) {
  const dto = plainToInstance(RegisterDto, data);
  return validate(dto);
}

describe('RegisterDto validation', () => {
  it('accepts a valid payload', async () => {
    const errors = await validateRegister({
      username: 'kevin',
      email: 'kevin@example.com',
      password: 'securePassword123',
    });
    expect(errors).toHaveLength(0);
  });

  it('normalizes email to lowercase', () => {
    const dto = plainToInstance(RegisterDto, {
      username: 'kevin',
      email: 'Kevin@Example.COM',
      password: 'securePassword123',
    });
    expect(dto.email).toBe('kevin@example.com');
  });

  it('rejects an invalid email', async () => {
    const errors = await validateRegister({
      username: 'kevin',
      email: 'not-an-email',
      password: 'securePassword123',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const errors = await validateRegister({
      username: 'kevin',
      email: 'kevin@example.com',
      password: 'short1',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a username shorter than 3 characters', async () => {
    const errors = await validateRegister({
      username: 'ke',
      email: 'kevin@example.com',
      password: 'securePassword123',
    });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('rejects a username longer than 30 characters', async () => {
    const errors = await validateRegister({
      username: 'k'.repeat(31),
      email: 'kevin@example.com',
      password: 'securePassword123',
    });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });
});
