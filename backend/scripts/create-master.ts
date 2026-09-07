/**
 * Promotes an already-registered account to MASTER. There is no HTTP
 * endpoint for this - the account must first exist via the normal
 * /api/auth/register flow, and this script (run with local/DB access) is the
 * only way to grant the first MASTER.
 *
 * Usage: npm run create-master -- <email>
 */
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run create-master -- <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(
      `No account found for ${email}. Register the account first via /api/auth/register, then re-run this script.`,
    );
    process.exit(1);
  }

  if (user.role === Role.MASTER) {
    console.log(`${email} is already MASTER.`);
    return;
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role: Role.MASTER },
  });

  console.log(`Promoted ${updated.username} (${updated.email}) to MASTER.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
