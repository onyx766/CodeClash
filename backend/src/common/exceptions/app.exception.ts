import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    // Optional extra fields merged into the error response body alongside
    // code/message - e.g. MATCH_ALREADY_FOUND's matchId. Omitted by default
    // so every existing subclass keeps its current {code, message} shape.
    details?: Record<string, unknown>,
  ) {
    super({ code, message, ...details }, status);
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

/**
 * Returned on any authentication attempt by a banned account, and by the JWT
 * strategy when an already-issued token belongs to one - so a ban takes effect
 * on the next request rather than when the token happens to expire.
 */
export class AccountBannedException extends AppException {
  constructor(message = 'This account has been suspended.') {
    super('ACCOUNT_BANNED', message, HttpStatus.FORBIDDEN);
  }
}

export class CannotModerateSelfException extends AppException {
  constructor(message = 'You cannot perform this action on your own account.') {
    super('CANNOT_MODERATE_SELF', message, HttpStatus.CONFLICT);
  }
}

/**
 * Moderation requires strictly outranking the target, so an ADMIN can never
 * ban another ADMIN or a MASTER.
 */
export class InsufficientRankException extends AppException {
  constructor(
    message = 'You can only moderate accounts ranked below your own.',
  ) {
    super('INSUFFICIENT_RANK', message, HttpStatus.FORBIDDEN);
  }
}

export class UserAlreadyInStateException extends AppException {
  constructor(message = 'This account is already in that state.') {
    super('USER_ALREADY_IN_STATE', message, HttpStatus.CONFLICT);
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

export class MatchmakingUnavailableException extends AppException {
  constructor() {
    super(
      'MATCHMAKING_UNAVAILABLE',
      'Matchmaking is temporarily unavailable.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class ActiveRoomExistsException extends AppException {
  constructor() {
    super(
      'ACTIVE_ROOM_EXISTS',
      'Leave or cancel your active room before starting Quick Match.',
      HttpStatus.CONFLICT,
    );
  }
}

export class ActiveMatchExistsException extends AppException {
  constructor() {
    super(
      'ACTIVE_MATCH_EXISTS',
      'You already have an active match.',
      HttpStatus.CONFLICT,
    );
  }
}

export class MatchNotFoundException extends AppException {
  constructor() {
    super('MATCH_NOT_FOUND', 'Match not found.', HttpStatus.NOT_FOUND);
  }
}

export class UserStatsNotFoundException extends AppException {
  constructor() {
    super(
      'USER_STATS_NOT_FOUND',
      'Your rating record could not be found.',
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * The eligible pool cannot supply a full set of distinct battle challenges.
 * A match is never started with fewer - see MatchSelectionService.
 */
export class InsufficientBattleChallengesException extends AppException {
  constructor() {
    super(
      'INSUFFICIENT_BATTLE_CHALLENGES',
      'Not enough eligible challenges are available to start a match.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class MatchAccessDeniedException extends AppException {
  constructor() {
    super(
      'MATCH_ACCESS_DENIED',
      'You are not a player in this match.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class MatchNotActiveException extends AppException {
  constructor(message = 'This match is not in progress.') {
    super('MATCH_NOT_ACTIVE', message, HttpStatus.CONFLICT);
  }
}

export class MatchAlreadyFinishedException extends AppException {
  constructor() {
    super(
      'MATCH_ALREADY_FINISHED',
      'This match has already finished.',
      HttpStatus.CONFLICT,
    );
  }
}

export class MatchAlreadyStartedException extends AppException {
  constructor(message = 'This room’s match has already started.') {
    super('MATCH_ALREADY_STARTED', message, HttpStatus.CONFLICT);
  }
}

export class MatchExpiredException extends AppException {
  constructor() {
    super('MATCH_EXPIRED', 'Time is up for this match.', HttpStatus.CONFLICT);
  }
}

export class MatchChallengeNotFoundException extends AppException {
  constructor() {
    super(
      'MATCH_CHALLENGE_NOT_FOUND',
      'This challenge is not part of the match.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class AlreadySolvedException extends AppException {
  constructor() {
    super(
      'ALREADY_SOLVED',
      'You have already solved this challenge.',
      HttpStatus.CONFLICT,
    );
  }
}

export class PlayerAlreadyGaveUpException extends AppException {
  constructor() {
    super(
      'PLAYER_ALREADY_GAVE_UP',
      'You have already given up this match.',
      HttpStatus.CONFLICT,
    );
  }
}

export class RunnerUnavailableException extends AppException {
  constructor() {
    super(
      'RUNNER_UNAVAILABLE',
      'The code runner is unavailable. Please try again.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class RoomNotFoundException extends AppException {
  constructor() {
    super('ROOM_NOT_FOUND', 'Room not found.', HttpStatus.NOT_FOUND);
  }
}

export class RoomAccessDeniedException extends AppException {
  constructor() {
    super(
      'ROOM_ACCESS_DENIED',
      'You are not a player in this room.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class RoomHostRequiredException extends AppException {
  constructor() {
    super(
      'ROOM_HOST_REQUIRED',
      'Only the room host can start the match.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class RoomNotReadyException extends AppException {
  constructor(message = 'This room is not ready to start a match.') {
    super('ROOM_NOT_READY', message, HttpStatus.CONFLICT);
  }
}

export class RoomExpiredException extends AppException {
  constructor() {
    super('ROOM_EXPIRED', 'This room has expired.', HttpStatus.CONFLICT);
  }
}

export class ChallengeNotFoundException extends AppException {
  constructor() {
    super('CHALLENGE_NOT_FOUND', 'Challenge not found.', HttpStatus.NOT_FOUND);
  }
}

export class ChallengeSlugExistsException extends AppException {
  constructor() {
    super(
      'CHALLENGE_SLUG_EXISTS',
      'Another challenge already uses this slug.',
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidChallengeException extends AppException {
  constructor(message = 'This challenge is not valid.') {
    super('INVALID_CHALLENGE', message, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidFunctionContractException extends AppException {
  constructor(message = 'The function contract is not valid.') {
    super('INVALID_FUNCTION_CONTRACT', message, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidTestCaseException extends AppException {
  constructor(message = 'A test case is not valid.') {
    super('INVALID_TEST_CASE', message, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidJudgeConfigurationException extends AppException {
  constructor(message = 'The judge configuration is not valid.') {
    super('INVALID_JUDGE_CONFIGURATION', message, HttpStatus.BAD_REQUEST);
  }
}

export class ChallengeValidationFailedException extends AppException {
  constructor(message = 'Challenge validation could not be completed.') {
    super(
      'CHALLENGE_VALIDATION_FAILED',
      message,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class ChallengeNotValidatedException extends AppException {
  constructor(
    message = 'This challenge must pass validation before it can be published.',
  ) {
    super('CHALLENGE_NOT_VALIDATED', message, HttpStatus.CONFLICT);
  }
}

export class ChallengeAlreadyPublishedException extends AppException {
  constructor() {
    super(
      'CHALLENGE_ALREADY_PUBLISHED',
      'This challenge is already published.',
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Raised instead of deleting a challenge that historical matches/submissions
 * still point at. Archiving is the supported way to retire one.
 */
export class ChallengeInUseException extends AppException {
  constructor(
    message = 'This challenge has been played and cannot be deleted. Archive it instead.',
  ) {
    super('CHALLENGE_IN_USE', message, HttpStatus.CONFLICT);
  }
}

/**
 * A published challenge's judging surface (contract, tests, judge method,
 * limits, executable code) is frozen so a live or historical match cannot have
 * its grading changed underneath it.
 */
export class ChallengeLockedException extends AppException {
  constructor(
    message = 'A published challenge’s tests and judging cannot be edited. Archive it and publish a new version instead.',
  ) {
    super('CHALLENGE_LOCKED', message, HttpStatus.CONFLICT);
  }
}

export class ImportInvalidJsonException extends AppException {
  constructor(message = 'The uploaded file is not valid challenge JSON.') {
    super('IMPORT_INVALID_JSON', message, HttpStatus.BAD_REQUEST);
  }
}

export class ImportFileTooLargeException extends AppException {
  constructor(message = 'The uploaded file is too large.') {
    super('IMPORT_FILE_TOO_LARGE', message, HttpStatus.PAYLOAD_TOO_LARGE);
  }
}

export class AiGenerationUnavailableException extends AppException {
  constructor(message = 'AI generation is not configured.') {
    super('AI_GENERATION_UNAVAILABLE', message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class AiGenerationFailedException extends AppException {
  constructor(message = 'AI generation failed.') {
    super('AI_GENERATION_FAILED', message, HttpStatus.BAD_GATEWAY);
  }
}

export class MatchAlreadyFoundException extends AppException {
  constructor(public readonly matchId: string | null) {
    super(
      'MATCH_ALREADY_FOUND',
      'A match has already been found.',
      HttpStatus.CONFLICT,
      matchId ? { matchId } : undefined,
    );
  }
}
