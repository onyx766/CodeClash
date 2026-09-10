-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "winnerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Submission_roundId_userId_key" ON "Submission"("roundId", "userId");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

