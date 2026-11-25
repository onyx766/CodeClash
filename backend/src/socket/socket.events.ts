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
  // { matchId?, reason? }. With a matchId, a Quick Match ended before it
  // started: READY_TIMEOUT (this player had not accepted in time) or
  // START_FAILED (both accepted but it could not start). Without one, the
  // search itself was dropped: STALE (no heartbeat) or JOINED_ROOM (the
  // player took a private-room seat).
  MATCHMAKING_CANCELLED: 'matchmaking:cancelled',
  // { matchId }: this player accepted, the opponent did not. The server puts
  // the player back in the queue right after (matchmaking:searching follows).
  MATCHMAKING_OPPONENT_UNAVAILABLE: 'matchmaking:opponent-unavailable',
  MATCHMAKING_ERROR: 'matchmaking:error',
  MATCH_READY: 'match:ready',

  // Server -> user channel. Private-room invitations, so the invitee sees
  // them without refreshing and the inviter learns the answer.
  INVITATION_RECEIVED: 'invitation:received',
  INVITATION_UPDATED: 'invitation:updated',
};

export const matchChannel = (matchId: string) => `match:${matchId}`;
