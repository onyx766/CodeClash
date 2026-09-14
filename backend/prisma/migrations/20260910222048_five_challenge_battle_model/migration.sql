-- Five-challenge battle model.
--
-- Replaces the best-of-3 Round format with MatchChallenge (the challenges
-- selected for a match) + MatchChallengeProgress (each player's state on each
-- one). Data-preserving plan for existing rows:
--
--   * every Round becomes a MatchChallenge with the SAME id, so historical
--     Submissions keep pointing at the challenge they were made for
--     (Submission.roundId -> Submission.matchChallengeId);
--   * Round.roundNumber -> MatchChallenge.position;
--   * round-format-only data (Round.startedAt/endsAt/finishedAt/winnerId,
--     Submission.score, Match.currentRoundNumber/totalRounds) is dropped - the
--     match-level result (Match.winnerId, status, RatingHistory) is kept;
--   * historical submissions are marked ACCEPTED when they passed every test,
--     WRONG_ANSWER otherwise;
--   * private-room matches get MatchParticipant rows backfilled from their
--     RoomPlayer rows (ratingBefore = the player's current UserStats.rating,
--     since private matches never snapshotted one and never move rating);
--   * any match still in flight in the old format (PENDING, PENDING_READY,
--     READY, IN_PROGRESS) cannot continue under the new engine and is
--     CANCELLED with finishReason SYSTEM_CANCELLED - never rated.

-- CreateEnum
CREATE TYPE "MatchFinishReason" AS ENUM ('ALL_CHALLENGES_SOLVED', 'PLAYER_GAVE_UP', 'TIME_EXPIRED', 'SYSTEM_CANCELLED', 'OPPONENT_DISCONNECTED');

-- CreateEnum
CREATE TYPE "MatchResultType" AS ENUM ('WIN', 'DRAW');

-- CreateEnum
CREATE TYPE "MatchChallengeStatus" AS ENUM ('NOT_STARTED', 'ATTEMPTING', 'SOLVED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('QUEUED', 'RUNNING', 'ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT', 'MEMORY_LIMIT', 'OUTPUT_LIMIT', 'SYSTEM_ERROR');

-- CreateTable
CREATE TABLE "MatchChallenge" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchChallengeProgress" (
    "id" TEXT NOT NULL,
    "matchChallengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MatchChallengeStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMP(3),
    "solvedAt" TIMESTAMP(3),
    "solveDurationMs" INTEGER,
    "bestSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchChallengeProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchChallenge_matchId_idx" ON "MatchChallenge"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchChallenge_matchId_challengeId_key" ON "MatchChallenge"("matchId", "challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchChallenge_matchId_position_key" ON "MatchChallenge"("matchId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MatchChallengeProgress_bestSubmissionId_key" ON "MatchChallengeProgress"("bestSubmissionId");

-- CreateIndex
CREATE INDEX "MatchChallengeProgress_userId_idx" ON "MatchChallengeProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchChallengeProgress_matchChallengeId_userId_key" ON "MatchChallengeProgress"("matchChallengeId", "userId");

-- AlterTable: Match gains the battle lifecycle columns. updatedAt gets a
-- temporary default so existing rows can be filled, then the default is
-- dropped to match Prisma's @updatedAt (which has none at the database level).
ALTER TABLE "Match"
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "finishReason" "MatchFinishReason",
ADD COLUMN     "resultType" "MatchResultType",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Match" SET "createdAt" = COALESCE("startedAt", "finishedAt", CURRENT_TIMESTAMP);

ALTER TABLE "Match" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MatchParticipant" ADD COLUMN     "gaveUpAt" TIMESTAMP(3),
ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserStats" ADD COLUMN     "casualDraws" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "draws" INTEGER NOT NULL DEFAULT 0;

-- Backfill: Round -> MatchChallenge, keeping the id. A round-format match
-- never repeated a challenge, but ON CONFLICT keeps this safe if one did (the
-- duplicate's submissions are then simply left without a matchChallengeId).
INSERT INTO "MatchChallenge" ("id", "matchId", "challengeId", "position", "createdAt")
SELECT r."id", r."matchId", r."challengeId", r."roundNumber", COALESCE(r."startedAt", m."startedAt", m."createdAt")
FROM "Round" r
JOIN "Match" m ON m."id" = r."matchId"
ORDER BY r."matchId", r."roundNumber"
ON CONFLICT DO NOTHING;

-- AlterTable: Submission moves from roundId to challenge/match/matchChallenge.
ALTER TABLE "Submission" RENAME COLUMN "code" TO "sourceCode";
ALTER TABLE "Submission" RENAME COLUMN "submittedAt" TO "createdAt";

ALTER TABLE "Submission"
ADD COLUMN     "challengeId" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'javascript',
ADD COLUMN     "matchChallengeId" TEXT,
ADD COLUMN     "matchId" TEXT,
ADD COLUMN     "memoryUsedKb" INTEGER,
ADD COLUMN     "runnerJobId" TEXT,
ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'QUEUED',
ALTER COLUMN "passedTests" DROP NOT NULL,
ALTER COLUMN "totalTests" DROP NOT NULL,
ALTER COLUMN "runtimeMs" DROP NOT NULL;

UPDATE "Submission" s
SET "challengeId" = r."challengeId",
    "matchId" = r."matchId",
    "matchChallengeId" = mc."id",
    "completedAt" = s."createdAt",
    "status" = CASE
      WHEN s."totalTests" > 0 AND s."passedTests" = s."totalTests" THEN 'ACCEPTED'::"SubmissionStatus"
      ELSE 'WRONG_ANSWER'::"SubmissionStatus"
    END
FROM "Round" r
LEFT JOIN "MatchChallenge" mc ON mc."id" = r."id"
WHERE r."id" = s."roundId";

ALTER TABLE "Submission" ALTER COLUMN "challengeId" SET NOT NULL;

-- DropForeignKey / DropIndex / DropColumn: the round link is fully migrated.
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_roundId_fkey";
DROP INDEX "Submission_roundId_userId_key";
ALTER TABLE "Submission" DROP COLUMN "roundId",
DROP COLUMN "score";

-- Backfill: private-room matches now use MatchParticipant like Quick Match.
INSERT INTO "MatchParticipant" ("id", "matchId", "userId", "ratingBefore", "joinedAt")
SELECT gen_random_uuid()::text, m."id", rp."userId", COALESCE(us."rating", 1200), rp."joinedAt"
FROM "Match" m
JOIN "RoomPlayer" rp ON rp."roomId" = m."roomId"
LEFT JOIN "UserStats" us ON us."userId" = rp."userId"
WHERE m."type" = 'PRIVATE_ROOM'
ON CONFLICT ("matchId", "userId") DO NOTHING;

-- Backfill: historical finished matches with a winner were wins.
UPDATE "Match" SET "resultType" = 'WIN'
WHERE "status" = 'FINISHED' AND "winnerId" IS NOT NULL;

-- Round-format matches still in flight cannot continue - cancel, never rate.
UPDATE "Match"
SET "status" = 'CANCELLED',
    "finishReason" = 'SYSTEM_CANCELLED',
    "finishedAt" = COALESCE("finishedAt", CURRENT_TIMESTAMP),
    "ratingReason" = 'ROUND_FORMAT_RETIRED'
WHERE "status" IN ('PENDING', 'PENDING_READY', 'READY', 'IN_PROGRESS');

-- Every match is now over, so its room is too. The round engine never closed
-- rooms, which left their hosts unable to create another one.
UPDATE "Room" SET "status" = 'FINISHED'
WHERE "id" IN (SELECT "roomId" FROM "Match" WHERE "roomId" IS NOT NULL);

-- DropTable: every Round row now lives on as a MatchChallenge.
ALTER TABLE "Round" DROP CONSTRAINT "Round_challengeId_fkey";
ALTER TABLE "Round" DROP CONSTRAINT "Round_matchId_fkey";
ALTER TABLE "Round" DROP CONSTRAINT "Round_winnerId_fkey";
DROP TABLE "Round";

ALTER TABLE "Match" DROP COLUMN "currentRoundNumber",
DROP COLUMN "totalRounds";

-- CreateIndex
CREATE INDEX "Match_status_expiresAt_idx" ON "Match"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Submission_matchChallengeId_userId_idx" ON "Submission"("matchChallengeId", "userId");

-- CreateIndex
CREATE INDEX "Submission_matchId_status_idx" ON "Submission"("matchId", "status");

-- CreateIndex
CREATE INDEX "Submission_userId_createdAt_idx" ON "Submission"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MatchChallenge" ADD CONSTRAINT "MatchChallenge_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchChallenge" ADD CONSTRAINT "MatchChallenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchChallengeProgress" ADD CONSTRAINT "MatchChallengeProgress_bestSubmissionId_fkey" FOREIGN KEY ("bestSubmissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchChallengeProgress" ADD CONSTRAINT "MatchChallengeProgress_matchChallengeId_fkey" FOREIGN KEY ("matchChallengeId") REFERENCES "MatchChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchChallengeProgress" ADD CONSTRAINT "MatchChallengeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_matchChallengeId_fkey" FOREIGN KEY ("matchChallengeId") REFERENCES "MatchChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
