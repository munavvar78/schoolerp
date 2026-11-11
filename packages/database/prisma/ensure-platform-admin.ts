import * as argon2 from 'argon2';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const email = 'master@bharatvidya.edu';

async function main() {
  const organization =
    (await prisma.organization.findUnique({ where: { slug: 'bharat-vidya' } })) ??
    (await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } }));
  if (!organization) {
    throw new Error('No organization exists yet. Create one before adding the master admin.');
  }
  const campus = await prisma.campus.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!campus) throw new Error('The organization has no campus.');

  const passwordHash = await argon2.hash('Password123!');
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: 'Master Admin', isActive: true, passwordHash },
    create: {
      organizationId: organization.id,
      email,
      name: 'Master Admin',
      passwordHash,
    },
  });
  await prisma.membership.upsert({
    where: {
      userId_campusId_role: {
        userId: user.id,
        campusId: campus.id,
        role: Role.PLATFORM_OPERATOR,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      userId: user.id,
      campusId: campus.id,
      role: Role.PLATFORM_OPERATOR,
    },
  });
  console.log(`Master admin ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Master admin setup failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
