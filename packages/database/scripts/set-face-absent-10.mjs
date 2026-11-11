import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const r = await prisma.onlineAssessment.updateMany({
  data: { faceAbsentSeconds: 10 },
});
console.log('updated', r.count);
await prisma.$disconnect();
