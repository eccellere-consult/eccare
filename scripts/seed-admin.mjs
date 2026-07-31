import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@eccare.in';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'EC Admin';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin account already exists: ${ADMIN_EMAIL} (role=${existing.role})`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email: ADMIN_EMAIL, passwordHash, name: ADMIN_NAME, role: 'admin' },
  });

  console.log(`Created admin account: ${user.email} / password: ${ADMIN_PASSWORD}`);
  console.log('Change this password after first login.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
