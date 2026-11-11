import type { PrismaService } from '../prisma/prisma.service.js';

export async function studentIdsForUser(
  prisma: PrismaService,
  organizationId: string,
  userId: string,
): Promise<string[]> {
  const guardian = await prisma.guardian.findFirst({
    where: { organizationId, userId },
    select: { students: { select: { studentId: true } } },
  });
  return guardian?.students.map((row) => row.studentId) ?? [];
}

export function withoutSensitiveStudentFields<T extends object>(student: T): Omit<T, 'apaarId' | 'apaarStatus' | 'customFields'> {
  const copy = { ...student } as T & {
    apaarId?: unknown;
    apaarStatus?: unknown;
    customFields?: unknown;
  };
  delete copy.apaarId;
  delete copy.apaarStatus;
  delete copy.customFields;
  return copy;
}
