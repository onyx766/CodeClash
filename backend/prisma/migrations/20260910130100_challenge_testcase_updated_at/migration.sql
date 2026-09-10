-- ChallengeTestCase.updatedAt only carried a database default so the previous
-- migration could backfill the pre-existing rows. Prisma drives @updatedAt from
-- the client, so drop the default to keep the database in sync with the schema.
ALTER TABLE "ChallengeTestCase" ALTER COLUMN "updatedAt" DROP DEFAULT;
