-- Safe Role enum migration.
--
-- The existing "Role" enum only has PLAYER/ADMIN values, and there are already
-- production-like rows using PLAYER. We cannot blindly drop/recreate the enum
-- (Prisma's naive diff would fail with "invalid input value for enum" on those
-- rows), so we explicitly map PLAYER -> USER while introducing MASTER.
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'ADMIN', 'MASTER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'PLAYER' THEN 'USER'
    ELSE "role"::text
  END::"Role_new"
);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "challengesSolved" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoriteLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "favoriteTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStats_userId_key" ON "UserStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing user gets a stats row seeded from their current
-- scalar columns (about to be dropped from "User"), plus empty profile/
-- preference rows, so no account is left without supporting records.
INSERT INTO "UserStats" ("id", "userId", "rating", "wins", "losses", "totalScore", "updatedAt")
SELECT gen_random_uuid()::text, "id", "rating", "wins", "losses", "totalScore", CURRENT_TIMESTAMP
FROM "User";

INSERT INTO "UserProfile" ("id", "userId", "updatedAt")
SELECT gen_random_uuid()::text, "id", CURRENT_TIMESTAMP
FROM "User";

INSERT INTO "UserPreference" ("id", "userId", "updatedAt")
SELECT gen_random_uuid()::text, "id", CURRENT_TIMESTAMP
FROM "User";

-- AlterTable: the scalar stat columns now live on "UserStats" and would
-- otherwise duplicate that data on "User".
ALTER TABLE "User" DROP COLUMN "losses",
DROP COLUMN "rating",
DROP COLUMN "totalScore",
DROP COLUMN "wins";
