import type { AuthenticatedUser } from '../../modules/auth/auth.types';

declare global {
  namespace Express {
    type User = AuthenticatedUser;
    interface Request {
      user?: User;
    }
  }
}

export {};
