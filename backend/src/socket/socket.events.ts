export const SocketEvents = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_UPDATE: 'room:update',

  // Client -> server: subscribe to / leave a match's broadcast channel.
  // Membership is verified server-side - see SocketGateway.onMatchJoin.
  MATCH_JOIN: 'match:join',
  MATCH_LEAVE: 'match:leave',

  // Server -> client. Sent to each player's user channel, because nobody has
  // joined the match channel yet when a match starts.
  MATCH_STARTED: 'match:started',
  // Server -> match channel. Counts and statuses only - never source code,
  // hidden test data or runner output.
  MATCH_PROGRESS: 'match:progress',
  CHALLENGE_ATTEMPTING: 'challenge:attempting',
  CHALLENGE_SOLVED: 'challenge:solved',
  PLAYER_GAVE_UP: 'player:gave-up',
  MATCH_FINISHED: 'match:finished',
  MATCH_CANCELLED: 'match:cancelled',

  MATCHMAKING_SEARCHING: 'matchmaking:searching',
  MATCHMAKING_MATCH_FOUND: 'matchmaking:match-found',
  MATCHMAKING_CANCELLED: 'matchmaking:cancelled',
  MATCHMAKING_OPPONENT_UNAVAILABLE: 'matchmaking:opponent-unavailable',
  MATCHMAKING_ERROR: 'matchmaking:error',
  MATCH_READY: 'match:ready',
};

export const matchChannel = (matchId: string) => `match:${matchId}`;
