import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  findTimetableConflicts,
  type PeriodSlotInput,
  type UpsertTimetableGridInput,
} from '@school-erp/shared';
import { AuditService } from '../common/audit.service.js';
import { studentIdsForUser } from '../common/family.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listSlots(organizationId: string, campusId: string) {
    return this.prisma.periodSlot.findMany({
      where: { organizationId, campusId },
      orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createSlot(
    organizationId: string,
    campusId: string,
    userId: string,
    input: PeriodSlotInput,
  ) {
    const slot = await this.prisma.periodSlot.create({
      data: {
        organizationId,
        campusId,
        code: input.code,
        label: input.label,
        sortOrder: input.sortOrder,
        startTime: input.startTime,
        endTime: input.endTime,
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'PeriodSlot',
      entityId: slot.id,
    });
    return slot;
  }

  async listBySection(
    organizationId: string,
    campusId: string,
    sectionId: string,
    sessionId: string,
    actor?: { role: string; userId: string },
  ) {
    if (actor?.role === 'PARENT' || actor?.role === 'STUDENT') {
      const studentIds = await studentIdsForUser(this.prisma, organizationId, actor.userId);
      const linked = await this.prisma.enrollment.findFirst({
        where: {
          sectionId,
          sessionId,
          studentId: { in: studentIds },
          student: { organizationId },
        },
      });
      if (!linked) return [];
    }
    return this.prisma.timetableEntry.findMany({
      where: { organizationId, campusId, sectionId, sessionId },
      include: {
        periodSlot: true,
        subject: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodSlot: { sortOrder: 'asc' } }],
    });
  }

  async listMine(
    organizationId: string,
    campusId: string,
    teacherUserId: string,
    sessionId?: string,
  ) {
    return this.prisma.timetableEntry.findMany({
      where: {
        organizationId,
        campusId,
        teacherUserId,
        ...(sessionId ? { sessionId } : {}),
      },
      include: {
        periodSlot: true,
        subject: true,
        section: { include: { grade: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodSlot: { sortOrder: 'asc' } }],
    });
  }

  async upsertGrid(
    organizationId: string,
    campusId: string,
    userId: string,
    input: UpsertTimetableGridInput,
  ) {
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, grade: { organizationId, campusId } },
    });
    if (!section) throw new NotFoundException('Section not found');

    const session = await this.prisma.academicSession.findFirst({
      where: { id: input.sessionId, organizationId, campusId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const proposed = input.entries.map((e) => ({
      dayOfWeek: e.dayOfWeek,
      periodSlotId: e.periodSlotId,
      teacherUserId: e.teacherUserId,
      sectionId: input.sectionId,
    }));
    const localConflicts = findTimetableConflicts(proposed);
    if (localConflicts.length) {
      throw new BadRequestException({
        message: 'Timetable conflicts in submitted grid',
        conflicts: localConflicts,
      });
    }

    // Cross-section teacher conflicts
    for (const e of input.entries) {
      const clash = await this.prisma.timetableEntry.findFirst({
        where: {
          organizationId,
          campusId,
          sessionId: input.sessionId,
          teacherUserId: e.teacherUserId,
          dayOfWeek: e.dayOfWeek,
          periodSlotId: e.periodSlotId,
          NOT: { sectionId: input.sectionId },
        },
      });
      if (clash) {
        throw new BadRequestException({
          message: 'Teacher already assigned in another section',
          conflicts: [
            {
              type: 'TEACHER_DOUBLE_BOOK',
              dayOfWeek: e.dayOfWeek,
              periodSlotId: e.periodSlotId,
              teacherUserId: e.teacherUserId,
            },
          ],
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.timetableEntry.deleteMany({
        where: {
          organizationId,
          campusId,
          sessionId: input.sessionId,
          sectionId: input.sectionId,
        },
      });
      if (input.entries.length) {
        await tx.timetableEntry.createMany({
          data: input.entries.map((e) => ({
            organizationId,
            campusId,
            sessionId: input.sessionId,
            sectionId: input.sectionId,
            dayOfWeek: e.dayOfWeek,
            periodSlotId: e.periodSlotId,
            subjectId: e.subjectId,
            teacherUserId: e.teacherUserId,
            room: e.room,
          })),
        });
      }
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPSERT_GRID',
      entityType: 'TimetableEntry',
      entityId: input.sectionId,
      meta: { count: input.entries.length },
    });

    return this.listBySection(
      organizationId,
      campusId,
      input.sectionId,
      input.sessionId,
    );
  }

  async listTeachers(organizationId: string, campusId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId,
        campusId,
        role: { in: ['TEACHER', 'CLASS_TEACHER'] },
      },
      include: { user: true },
    });
    return memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    }));
  }
}
