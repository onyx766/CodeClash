import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  AccountBannedException,
  UnauthenticatedException,
} from '../../../common/exceptions/app.exception';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: AuthenticatedUser | false,
  ): TUser {
    // A banned account is a specific, actionable answer ("this account has
    // been suspended"), not the generic "you are not signed in" - so it is
    // passed through instead of being flattened like every other failure.
    if (err instanceof AccountBannedException) {
      throw err;
    }
    if (err || !user) {
      throw new UnauthenticatedException();
    }
    return user as TUser;
  }
}
