-- Session revocation for admin password resets.
--
-- Access tokens are issued without an expiry, so changing a password alone
-- would leave every existing session valid. Tokens whose `iat` predates this
-- column are refused by JwtStrategy and AuthService.refresh.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionsRevokedAt" TIMESTAMP(3);
