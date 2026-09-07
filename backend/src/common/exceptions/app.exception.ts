import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status);
  }
}

export class EmailAlreadyExistsException extends AppException {
  constructor() {
    super(
      'EMAIL_ALREADY_EXISTS',
      'An account with this email already exists.',
      HttpStatus.CONFLICT,
    );
  }
}

export class UsernameAlreadyExistsException extends AppException {
  constructor() {
    super(
      'USERNAME_ALREADY_EXISTS',
      'This username is already taken.',
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidCredentialsException extends AppException {
  constructor() {
    super(
      'INVALID_CREDENTIALS',
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class UnauthenticatedException extends AppException {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class UserNotFoundException extends AppException {
  constructor() {
    super('USER_NOT_FOUND', 'User not found.', HttpStatus.NOT_FOUND);
  }
}

export class UsernameNotFoundException extends AppException {
  constructor() {
    super(
      'USERNAME_NOT_FOUND',
      'No user with this username was found.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ProfileNotFoundException extends AppException {
  constructor() {
    super('PROFILE_NOT_FOUND', 'Profile not found.', HttpStatus.NOT_FOUND);
  }
}

export class InvalidProfileDataException extends AppException {
  constructor(message = 'Invalid profile data.') {
    super('INVALID_PROFILE_DATA', message, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidRoleException extends AppException {
  constructor() {
    super('INVALID_ROLE', 'Invalid role.', HttpStatus.BAD_REQUEST);
  }
}

export class ForbiddenRoleChangeException extends AppException {
  constructor(message = 'You are not allowed to make this role change.') {
    super('FORBIDDEN_ROLE_CHANGE', message, HttpStatus.FORBIDDEN);
  }
}

export class LastMasterRequiredException extends AppException {
  constructor() {
    super(
      'LAST_MASTER_REQUIRED',
      'At least one MASTER account must remain.',
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidMatchStateException extends AppException {
  constructor(message = 'Rating cannot be applied to a match in this state.') {
    super('INVALID_MATCH_STATE', message, HttpStatus.CONFLICT);
  }
}

export class RoomAlreadyHostedException extends AppException {
  constructor() {
    super(
      'ROOM_ALREADY_HOSTED',
      'You already have an active room. Close or leave it before creating another.',
      HttpStatus.CONFLICT,
    );
  }
}

export class InvitationNotFoundException extends AppException {
  constructor() {
    super('INVITATION_NOT_FOUND', 'Invitation not found.', HttpStatus.NOT_FOUND);
  }
}

export class InvitationAlreadyHandledException extends AppException {
  constructor() {
    super(
      'INVITATION_ALREADY_HANDLED',
      'This invitation has already been responded to.',
      HttpStatus.CONFLICT,
    );
  }
}
