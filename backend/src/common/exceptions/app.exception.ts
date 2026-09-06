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
