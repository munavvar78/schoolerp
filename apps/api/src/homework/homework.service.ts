import { Injectable, NotFoundException } from '@nestjs/common';
import {
  resolveHomeworkStatus,
  type CreateHomeworkInput,
  type MarkHomeworkCompletionInput,
} from '@school-erp/shared';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HomeworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    organizationId: string,
    campusId: string,
    query?: { sectionId?: string; sessionId?: string },
  ) {
    const items = await this.prisma.homework.findMany({
      where: {
        organizationId,
        campusId,
        ...(query?.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query?.sessionId ? { sessionId: query.sessionId } : {}),
      },
      include: {
        subject: true,
        section: { include: { grade: true } },
        completions: true,
      },
      orderBy: [{ dueDate: 'desc' }],
      take: 100,
    });

    const graceRule = await this.prisma.ruleConfig.findFirst({
      where: { organizationId, campusId, key: 'homework_late_grace_days' },
      orderBy: { version: 'desc' },
    });
    const graceDays =
      typeof graceRule?.value === 'object' &&
      graceRule.value &&
      'days' in (graceRule.value as object)
        ? Number((graceRule.value as { days: number }).days)
        : 0;

    const now = new Date();
    return items.map((hw) => ({
      ...hw,
      effectiveStatusHint: resolveHomeworkStatus(
        hw.dueDate,
        now,
        'ASSIGNED',
        graceDays,
      ),
    }));
  }

  async create(
    organizationId: string,
    campusId: string,
    userId: string,
    input: CreateHomeworkInput,
  ) {
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, grade: { organizationId, campusId } },
    });
    if (!section) throw new NotFoundException('Section not found');

    const homework = await this.prisma.homework.create({
      data: {
        organizationId,
        campusId,
        sessionId: input.sessionId,
        sectionId: input.sectionId,
        subjectId: input.subjectId,
        title: input.title,
        description: input.description,
        dueDate: new Date(input.dueDate),
        attachmentUrl: input.attachmentUrl || null,
        createdByUserId: userId,
      },
      include: { subject: true, section: true },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId: input.sectionId, sessionId: input.sessionId },
    });
    if (enrollments.length) {
      await this.prisma.homeworkCompletion.createMany({
        data: enrollments.map((e) => ({
          homeworkId: homework.id,
          enrollmentId: e.id,
          status: 'ASSIGNED',
        })),
      });
    }

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'Homework',
      entityId: homework.id,
    });
    return homework;
  }

  async markCompletion(
    organizationId: string,
    userId: string,
    input: MarkHomeworkCompletionInput,
  ) {
    const homework = await this.prisma.homework.findFirst({
      where: { id: input.homeworkId, organizationId },
    });
    if (!homework) throw new NotFoundException('Homework not found');

    const completion = await this.prisma.homeworkCompletion.upsert({
      where: {
        homeworkId_enrollmentId: {
          homeworkId: input.homeworkId,
          enrollmentId: input.enrollmentId,
        },
      },
      create: {
        homeworkId: input.homeworkId,
        enrollmentId: input.enrollmentId,
        status: input.status,
        note: input.note,
        checkedAt: input.status === 'CHECKED' ? new Date() : null,
      },
      update: {
        status: input.status,
        note: input.note,
        checkedAt: input.status === 'CHECKED' ? new Date() : undefined,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'MARK_COMPLETION',
      entityType: 'HomeworkCompletion',
      entityId: completion.id,
    });
    return completion;
  }

  async forParent(organizationId: string, userId: string) {
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
    if (!guardian) return [];

    const enrollmentIds = guardian.students.flatMap((s) =>
      s.student.enrollments.map((e) => e.id),
    );
    const sectionIds = guardian.students.flatMap((s) =>
      s.student.enrollments.map((e) => e.sectionId),
    );

    const homeworks = await this.prisma.homework.findMany({
      where: {
        organizationId,
        sectionId: { in: sectionIds },
      },
      include: {
        subject: true,
        section: { include: { grade: true } },
        completions: { where: { enrollmentId: { in: enrollmentIds } } },
      },
      orderBy: [{ dueDate: 'desc' }],
      take: 50,
    });

    return homeworks.map((hw) => ({
      ...hw,
      childCompletions: hw.completions,
    }));
  }
}
