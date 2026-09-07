import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(user: { role: Role } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  function guardWithRequiredRoles(roles: Role[] | undefined) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(roles),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('allows the request when no roles are required', () => {
    const guard = guardWithRequiredRoles(undefined);
    expect(guard.canActivate(contextWithUser({ role: Role.USER }))).toBe(true);
  });

  it('denies a USER on an ADMIN-only route', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ role: Role.USER }))).toBe(false);
  });

  it('allows an ADMIN on an ADMIN-only route', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ role: Role.ADMIN }))).toBe(true);
  });

  it('allows a MASTER on an ADMIN-only route via the role hierarchy', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ role: Role.MASTER }))).toBe(true);
  });

  it('denies an ADMIN on a MASTER-only route', () => {
    const guard = guardWithRequiredRoles([Role.MASTER]);
    expect(guard.canActivate(contextWithUser({ role: Role.ADMIN }))).toBe(false);
  });

  it('denies the request when there is no authenticated user', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN]);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(false);
  });
});
