-- Challenge authoring system.
--
-- Hand-written rather than generated so the existing Challenge/ChallengeTestCase
-- rows survive: slug is backfilled from the title, `isPublished` is folded into
-- the new `status` column, and the test-case input/expectedOutput text columns
-- are cast to JSONB instead of being dropped and recreated.

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChallengeProblemType" AS ENUM ('FUNCTION', 'STANDARD_IO');

-- CreateEnum
CREATE TYPE "JudgeMethod" AS ENUM ('EXACT', 'DEEP_EQUAL', 'CUSTOM_CHECKER', 'REFERENCE');

-- CreateEnum
CREATE TYPE "ChallengeCreationMode" AS ENUM ('MANUAL', 'AI', 'JSON_IMPORT');

-- CreateEnum
CREATE TYPE "ChallengeValidationStatus" AS ENUM ('NOT_CHECKED', 'PASSED', 'FAILED');

-- AlterEnum
ALTER TYPE "Difficulty" ADD VALUE 'EXPERT';

-- DropForeignKey
ALTER TABLE "ChallengeTestCase" DROP CONSTRAINT "ChallengeTestCase_challengeId_fkey";

-- AlterTable: new Challenge columns (slug stays nullable until backfilled)
ALTER TABLE "Challenge"
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "problemType" "ChallengeProblemType" NOT NULL DEFAULT 'FUNCTION',
ADD COLUMN     "parameters" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "returnType" TEXT NOT NULL DEFAULT 'any',
ADD COLUMN     "judgeMethod" "JudgeMethod" NOT NULL DEFAULT 'DEEP_EQUAL',
ADD COLUMN     "customCheckerCode" TEXT,
ADD COLUMN     "referenceSolutionCode" TEXT,
ADD COLUMN     "testGeneratorCode" TEXT,
ADD COLUMN     "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "memoryLimitMb" INTEGER NOT NULL DEFAULT 128,
ADD COLUMN     "outputLimitKb" INTEGER NOT NULL DEFAULT 64,
ADD COLUMN     "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "creationMode" "ChallengeCreationMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "validationStatus" "ChallengeValidationStatus" NOT NULL DEFAULT 'NOT_CHECKED',
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validationChecks" JSONB,
ADD COLUMN     "validationFingerprint" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- Backfill: slug from title, then disambiguate collisions/empties with the id.
UPDATE "Challenge"
SET "slug" = trim(BOTH '-' FROM regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'));

UPDATE "Challenge"
SET "slug" = 'challenge-' || substr("id", 1, 8)
WHERE "slug" IS NULL OR "slug" = '';

UPDATE "Challenge" c
SET "slug" = c."slug" || '-' || substr(c."id", 1, 8)
WHERE EXISTS (
  SELECT 1 FROM "Challenge" o WHERE o."slug" = c."slug" AND o."id" <> c."id"
);

-- Backfill: isPublished -> status/publishedAt.
UPDATE "Challenge"
SET "status" = 'PUBLISHED', "publishedAt" = "createdAt"
WHERE "isPublished" = TRUE;

-- Backfill: legacy challenges have no declared parameters. The runner builds a
-- positional argument list from this array, so a single `input` parameter
-- reproduces the old fn(input) call convention exactly.
UPDATE "Challenge"
SET "parameters" = '[{"name":"input","type":"any"}]'::jsonb
WHERE "parameters" = '[]'::jsonb;

ALTER TABLE "Challenge" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "isPublished";

-- Text -> JSONB for test-case data. Existing rows already hold JSON text
-- (e.g. '[1,2,3]', '"abc"', '6'); anything that is not parseable is preserved
-- as a JSON string rather than failing the migration.
CREATE FUNCTION "codeclash_migration_safe_jsonb"(txt TEXT) RETURNS JSONB AS $$
BEGIN
  RETURN txt::jsonb;
EXCEPTION WHEN others THEN
  RETURN to_jsonb(txt);
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "ChallengeTestCase"
ALTER COLUMN "input" TYPE JSONB
  USING jsonb_build_object('input', "codeclash_migration_safe_jsonb"("input"));

ALTER TABLE "ChallengeTestCase"
ALTER COLUMN "expectedOutput" TYPE JSONB
  USING "codeclash_migration_safe_jsonb"("expectedOutput");

DROP FUNCTION "codeclash_migration_safe_jsonb"(TEXT);

-- AlterTable
ALTER TABLE "ChallengeTestCase"
ALTER COLUMN "expectedOutput" DROP NOT NULL,
ALTER COLUMN "isHidden" SET DEFAULT true,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: distinct order per challenge, public tests first.
WITH ordered AS (
  SELECT "id", (row_number() OVER (PARTITION BY "challengeId" ORDER BY "isHidden", "id") - 1) AS rn
  FROM "ChallengeTestCase"
)
UPDATE "ChallengeTestCase" t
SET "order" = ordered.rn
FROM ordered
WHERE t."id" = ordered."id";

-- CreateTable
CREATE TABLE "ChallengeTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ChallengeToChallengeTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeTag_slug_key" ON "ChallengeTag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "_ChallengeToChallengeTag_AB_unique" ON "_ChallengeToChallengeTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ChallengeToChallengeTag_B_index" ON "_ChallengeToChallengeTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_slug_key" ON "Challenge"("slug");

-- CreateIndex
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");

-- CreateIndex
CREATE INDEX "ChallengeTestCase_challengeId_idx" ON "ChallengeTestCase"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeTestCase_challengeId_order_key" ON "ChallengeTestCase"("challengeId", "order");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeTestCase" ADD CONSTRAINT "ChallengeTestCase_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChallengeToChallengeTag" ADD CONSTRAINT "_ChallengeToChallengeTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChallengeToChallengeTag" ADD CONSTRAINT "_ChallengeToChallengeTag_B_fkey" FOREIGN KEY ("B") REFERENCES "ChallengeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
