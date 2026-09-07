const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email: 'naro@gmail.com' } });
  if (!user) { console.log('NO USER FOUND for naro@gmail.com'); process.exit(0); }
  console.log(JSON.stringify({ id: user.id, email: user.email, username: user.username, role: user.role, hashPrefix: user.passwordHash.slice(0, 20), hashLen: user.passwordHash.length, createdAt: user.createdAt }, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
