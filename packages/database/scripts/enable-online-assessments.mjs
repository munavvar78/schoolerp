import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const orgs = await prisma.organization.findMany();
for (const o of orgs) {
  if (!o.enabledModules.includes('online_assessments')) {
    await prisma.organization.update({
      where: { id: o.id },
      data: { enabledModules: [...o.enabledModules, 'online_assessments'] },
    });
    console.log('updated', o.slug);
  } else {
    console.log('ok', o.slug);
  }
}
await prisma.$disconnect();
