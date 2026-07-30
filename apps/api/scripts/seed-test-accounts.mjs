import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ACCOUNTS = [
  { email: 'admin@eccare.in', password: 'Admin@EC2026', name: 'EC Admin', role: 'admin' },
  { email: 'provider@eccare.in', password: 'Provider@EC2026', name: 'City Care Clinic', role: 'provider' },
];

async function main() {
  for (const acc of ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: acc.email } });
    if (existing) {
      console.log(`Already exists: ${acc.email} (role=${existing.role})`);
      continue;
    }
    const passwordHash = await bcrypt.hash(acc.password, 10);
    await prisma.user.create({
      data: { email: acc.email, passwordHash, name: acc.name, role: acc.role },
    });
    console.log(`Created: ${acc.email} / ${acc.password} (${acc.role})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
