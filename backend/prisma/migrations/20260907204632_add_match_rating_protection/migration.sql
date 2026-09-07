-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('QUICK_MATCH', 'PRIVATE_ROOM');

-- CreateEnum
CREATE TYPE "MatchRiskStatus" AS ENUM ('NORMAL', 'SUSPICIOUS', 'BLOCKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MatchStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "MatchStatus" ADD VALUE 'ABANDONED';
ALTER TYPE "MatchStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "ratingEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ratingProcessedAt" TIMESTAMP(3),
ADD COLUMN     "ratingReason" TEXT,
ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "riskStatus" "MatchRiskStatus",
ADD COLUMN     "type" "MatchType" NOT NULL DEFAULT 'PRIVATE_ROOM';

-- AlterTable
ALTER TABLE "UserStats" ADD COLUMN     "casualLosses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "casualMatchesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "casualWins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RatingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "previousRating" INTEGER NOT NULL,
    "newRating" INTEGER NOT NULL,
    "change" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RatingHistory_userId_createdAt_idx" ON "RatingHistory"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RatingHistory_userId_matchId_key" ON "RatingHistory"("userId", "matchId");

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
