import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { 
      email: true, 
      role: true, 
      name: true,
      passwordHash: true 
    }
  });
  
  console.log('📋 Users in database:');
  users.forEach(user => {
    console.log(`- ${user.email} (${user.role}) - Hash: ${user.passwordHash ? 'YES' : 'NO'}`);
  });
  
  await prisma.$disconnect();
}

checkUsers();
