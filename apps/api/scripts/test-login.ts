import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testLogin() {
  const email = 'caregiver@test.com';
  const password = 'caregiver123';
  
  console.log(`🔍 Testing login for: ${email}`);
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    console.log('❌ User not found');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ User found: ${user.name} (${user.role})`);
  console.log(`📧 Email: ${user.email}`);
  console.log(`🔐 Has password hash: ${user.passwordHash ? 'YES' : 'NO'}`);
  console.log(`🔐 Hash starts with: ${user.passwordHash?.substring(0, 20)}...`);
  
  const valid = await bcrypt.compare(password, user.passwordHash || '');
  console.log(`🔑 Password valid: ${valid ? '✅ YES' : '❌ NO'}`);
  
  if (!valid) {
    // Try to regenerate hash and check
    const newHash = await bcrypt.hash(password, 10);
    console.log(`\n🔄 Generating new hash for comparison...`);
    console.log(`New hash: ${newHash.substring(0, 20)}...`);
    console.log(`Old hash: ${user.passwordHash?.substring(0, 20)}...`);
    
    const testValid = await bcrypt.compare(password, newHash);
    console.log(`Test with new hash works: ${testValid ? '✅ YES' : '❌ NO'}`);
  }
  
  await prisma.$disconnect();
}

testLogin();
