import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UnauthenticatedException } from '../../../common/exceptions/app.exception';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: AuthenticatedUser | false,
  ): TUser {
    if (err || !user) {
      throw new UnauthenticatedException();
    }
    return user as TUser;
  }
}
