import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    // Create a test elder
    const elderPasswordHash = await bcrypt.hash('elder123', 10);
    const elder = await prisma.user.upsert({
      where: { email: 'elder@test.com' },
      update: {},
      create: {
        email: 'elder@test.com',
        passwordHash: elderPasswordHash,
        name: 'Test Elder',
        role: 'elder',
        phone: '+919876543210',
      },
    });
    console.log('✅ Test Elder created:', elder.email);

    // Create a test caregiver
    const caregiverPasswordHash = await bcrypt.hash('caregiver123', 10);
    const caregiver = await prisma.user.upsert({
      where: { email: 'caregiver@test.com' },
      update: {},
      create: {
        email: 'caregiver@test.com',
        passwordHash: caregiverPasswordHash,
        name: 'Test Caregiver',
        role: 'caregiver',
        phone: '+919876543211',
      },
    });
    console.log('✅ Test Caregiver created:', caregiver.email);

    // Link them as family
    await prisma.familyRelation.upsert({
      where: {
        elderUserId_caregiverUserId: {
          elderUserId: elder.id,
          caregiverUserId: caregiver.id,
        },
      },
      update: {},
      create: {
        elderUserId: elder.id,
        caregiverUserId: caregiver.id,
        relationship: 'son',
        canViewHealth: true,
        canManageMeds: true,
        receivesSos: true,
        receivesCheckin: true,
        inviteStatus: 'accepted',
      },
    });
    console.log('✅ Family relation created');

    // Create an admin
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        email: 'admin@test.com',
        passwordHash: adminPasswordHash,
        name: 'Test Admin',
        role: 'admin',
      },
    });
    console.log('✅ Test Admin created:', admin.email);

    console.log('\n📝 Test Credentials:');
    console.log('Elder:     elder@test.com / elder123');
    console.log('Caregiver: caregiver@test.com / caregiver123');
    console.log('Admin:     admin@test.com / admin123');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createTestUsers();
