import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@school-erp/database';
import { AuditService } from '../common/audit.service.js';
import { withoutSensitiveStudentFields } from '../common/family.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    organizationId: string,
    campusId: string,
    query: { q?: string; sectionId?: string; sessionId?: string },
    role?: string,
  ) {
    const where: Prisma.StudentWhereInput = {
      organizationId,
      campusId,
      isActive: true,
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { admissionNo: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.sectionId || query.sessionId
        ? {
            enrollments: {
              some: {
                ...(query.sectionId ? { sectionId: query.sectionId } : {}),
                ...(query.sessionId ? { sessionId: query.sessionId } : {}),
              },
            },
          }
        : {}),
    };

    const rows = await this.prisma.student.findMany({
      where,
      include: {
        enrollments: { include: { section: { include: { grade: true } }, session: true } },
        guardians: { include: { guardian: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 200,
    });
    if (role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN' || role === 'PLATFORM_OPERATOR') return rows;
    return rows.map((row) => {
      const student = withoutSensitiveStudentFields(row);
      return {
        ...student,
        guardians: row.guardians.map((link) => ({
          ...link,
          guardian: {
            id: link.guardian.id,
            name: link.guardian.name,
            relation: link.guardian.relation,
            phone: link.guardian.phone,
            email: link.guardian.email,
          },
        })),
      };
    });
  }

  async create(
    organizationId: string,
    campusId: string,
    userId: string,
    input: {
      firstName: string;
      lastName?: string;
      admissionNo: string;
      dateOfBirth?: string;
      gender?: 'MALE' | 'FEMALE' | 'OTHER';
      customFields?: Record<string, unknown>;
    },
  ) {
    const existing = await this.prisma.student.findFirst({
      where: { campusId, organizationId, admissionNo: input.admissionNo },
    });
    if (existing) {
      throw new BadRequestException(`Admission no already exists: ${input.admissionNo}`);
    }

    const student = await this.prisma.student.create({
      data: {
        organizationId,
        campusId,
        firstName: input.firstName,
        lastName: input.lastName,
        admissionNo: input.admissionNo,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender,
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'Student',
      entityId: student.id,
    });
    return student;
  }

  async createBulk(
    organizationId: string,
    campusId: string,
    userId: string,
    input: {
      students: Array<{
        firstName: string;
        lastName?: string;
        admissionNo: string;
        dateOfBirth?: string;
        gender?: 'MALE' | 'FEMALE' | 'OTHER';
        rollNo?: string;
        customFields?: Record<string, unknown>;
      }>;
      sessionId?: string;
      sectionId?: string;
    },
  ) {
    if (input.sessionId || input.sectionId) {
      if (!input.sessionId || !input.sectionId) {
        throw new BadRequestException('Provide both sessionId and sectionId to auto-enroll');
      }
      const section = await this.prisma.section.findFirst({
        where: { id: input.sectionId, grade: { organizationId, campusId } },
      });
      if (!section) throw new NotFoundException('Section not found');
      const session = await this.prisma.academicSession.findFirst({
        where: { id: input.sessionId, organizationId, campusId },
      });
      if (!session) throw new NotFoundException('Session not found');
    }

    const admissionNos = input.students.map((row) => row.admissionNo);
    const existing = await this.prisma.student.findMany({
      where: {
        organizationId,
        campusId,
        admissionNo: { in: admissionNos },
      },
      select: { admissionNo: true },
    });
    const existingSet = new Set(existing.map((row) => row.admissionNo.toUpperCase()));

    const created: Array<{ id: string; admissionNo: string; enrolled: boolean }> = [];
    const errors: Array<{ admissionNo: string; message: string }> = [];

    for (const row of input.students) {
      if (existingSet.has(row.admissionNo.toUpperCase())) {
        errors.push({
          admissionNo: row.admissionNo,
          message: 'Admission no already exists on this campus',
        });
        continue;
      }

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: {
              organizationId,
              campusId,
              firstName: row.firstName,
              lastName: row.lastName,
              admissionNo: row.admissionNo,
              dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
              gender: row.gender,
              customFields: (row.customFields ?? {}) as Prisma.InputJsonValue,
            },
          });

          let enrolled = false;
          if (input.sessionId && input.sectionId) {
            await tx.enrollment.create({
              data: {
                studentId: student.id,
                sectionId: input.sectionId,
                sessionId: input.sessionId,
                rollNo: row.rollNo,
              },
            });
            enrolled = true;
          }

          return { id: student.id, admissionNo: student.admissionNo, enrolled };
        });

        existingSet.add(row.admissionNo.toUpperCase());
        created.push(result);
      } catch (err) {
        errors.push({
          admissionNo: row.admissionNo,
          message: err instanceof Error ? err.message : 'Create failed',
        });
      }
    }

    await this.audit.log({
      organizationId,
      userId,
      action: 'BULK_CREATE',
      entityType: 'Student',
      meta: {
        requested: input.students.length,
        created: created.length,
        failed: errors.length,
        autoEnroll: Boolean(input.sessionId && input.sectionId),
      },
    });

    return {
      createdCount: created.length,
      failedCount: errors.length,
      created,
      errors,
    };
  }

  async enroll(
    organizationId: string,
    userId: string,
    input: { studentId: string; sectionId: string; sessionId: string; rollNo?: string },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, grade: { organizationId } },
    });
    if (!section) throw new NotFoundException('Section not found');
    const session = await this.prisma.academicSession.findFirst({
      where: { id: input.sessionId, organizationId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const enrollment = await this.prisma.enrollment.upsert({
      where: {
        studentId_sessionId: { studentId: input.studentId, sessionId: input.sessionId },
      },
      create: {
        studentId: input.studentId,
        sectionId: input.sectionId,
        sessionId: input.sessionId,
        rollNo: input.rollNo,
      },
      update: {
        sectionId: input.sectionId,
        rollNo: input.rollNo,
      },
      include: { student: true, section: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ENROLL',
      entityType: 'Enrollment',
      entityId: enrollment.id,
    });
    return enrollment;
  }

  async bulkEnroll(
    organizationId: string,
    campusId: string,
    userId: string,
    input: { studentIds: string[]; sectionId: string; sessionId: string },
  ) {
    // Validate section belongs to this org+campus
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, grade: { organizationId, campusId } },
      include: { grade: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    // Validate session belongs to this org+campus
    const session = await this.prisma.academicSession.findFirst({
      where: { id: input.sessionId, organizationId, campusId },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Validate all students belong to this org+campus and are active
    const students = await this.prisma.student.findMany({
      where: { id: { in: input.studentIds }, organizationId, campusId, isActive: true },
      select: { id: true },
    });
    const foundIds = new Set(students.map((s) => s.id));
    const missing = input.studentIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new BadRequestException(
        `${missing.length} student(s) not found or inactive on this campus`,
      );
    }

    // Upsert enrollments in a single transaction
    const upserts = input.studentIds.map((studentId) =>
      this.prisma.enrollment.upsert({
        where: { studentId_sessionId: { studentId, sessionId: input.sessionId } },
        create: { studentId, sectionId: input.sectionId, sessionId: input.sessionId },
        update: { sectionId: input.sectionId },
      }),
    );
    await this.prisma.$transaction(upserts);

    await this.audit.log({
      organizationId,
      userId,
      action: 'BULK_ENROLL',
      entityType: 'Enrollment',
      entityId: input.sectionId,
      meta: {
        count: input.studentIds.length,
        sectionId: input.sectionId,
        sessionId: input.sessionId,
      },
    });

    return {
      success: true,
      count: input.studentIds.length,
      section: { id: section.id, name: section.name, gradeName: section.grade.name },
      session: { id: session.id, name: session.name },
    };
  }

  async addGuardian(
    organizationId: string,
    input: {
      studentId: string;
      name: string;
      relation: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
      phone?: string;
      email?: string;
      customFields?: Record<string, unknown>;
      linkUserId?: string;
      isPrimary?: boolean;
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const guardian = await this.prisma.guardian.create({
      data: {
        organizationId,
        name: input.name,
        relation: input.relation,
        phone: input.phone,
        email: input.email,
        userId: input.linkUserId,
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
        students: {
          create: { studentId: input.studentId, isPrimary: input.isPrimary ?? false },
        },
      },
      include: { students: true },
    });
    return guardian;
  }

  async getForParent(organizationId: string, userId: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { organizationId, userId },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  include: { section: { include: { grade: true } }, session: true },
                },
              },
            },
          },
        },
      },
    });
    return (guardian?.students ?? []).map((link) => withoutSensitiveStudentFields(link.student));
  }
}
