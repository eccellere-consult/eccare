import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  const email = 'admin@eccare.in';
  const newPassword = 'Admin@EC2026';

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      console.log(`❌ User ${email} not found`);
      await prisma.$disconnect();
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    console.log(`✅ Password reset for ${email}`);
    console.log(`📝 New password: ${newPassword}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
  }
}

resetAdminPassword();
