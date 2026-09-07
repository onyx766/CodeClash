import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
import { UpdateRoleDto } from './update-role.dto';

async function validateDto(data: Partial<UpdateRoleDto>) {
  const dto = plainToInstance(UpdateRoleDto, data);
  return validate(dto);
}

describe('UpdateRoleDto validation', () => {
  it.each([Role.USER, Role.ADMIN, Role.MASTER])('accepts role %s', async (role) => {
    const errors = await validateDto({ role });
    expect(errors).toHaveLength(0);
  });

  it('rejects a role outside the Role enum', async () => {
    const errors = await validateDto({ role: 'SUPERADMIN' as Role });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects a missing role', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });
});
