export const SocketEvents = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_UPDATE: 'room:update',
  MATCH_START: 'match:start',
  ROUND_START: 'round:start',
  ROUND_UPDATE: 'round:update',
  ROUND_END: 'round:end',
  // Tells a player their opponent has locked in a submission, without leaking
  // the opponent's code or score while the round is still open.
  ROUND_OPPONENT_SUBMITTED: 'round:opponent-submitted',
  MATCH_END: 'match:end',
  SUBMISSION_RESULT: 'submission:result',
  MATCHMAKING_SEARCHING: 'matchmaking:searching',
  MATCHMAKING_MATCH_FOUND: 'matchmaking:match-found',
  MATCHMAKING_CANCELLED: 'matchmaking:cancelled',
  MATCHMAKING_OPPONENT_UNAVAILABLE: 'matchmaking:opponent-unavailable',
  MATCHMAKING_ERROR: 'matchmaking:error',
  MATCH_READY: 'match:ready',
};
