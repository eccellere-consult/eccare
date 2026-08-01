import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const result = await prisma.familyRelation.updateMany({
  where: { canManageMeds: false },
  data: { canManageMeds: true },
});
console.log(`Updated ${result.count} family relations — canManageMeds set to true`);
await prisma.$disconnect();
