import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  attendancePercentage,
  completeAttendanceRoster,
  presentStatusCode,
  validateAttendanceDate,
} from '@school-erp/shared';
import { AuditService } from '../common/audit.service.js';
import { studentIdsForUser, withoutSensitiveStudentFields } from '../common/family.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertAttendanceDate(
    date: string,
    session: { startDate: Date; endDate: Date },
  ) {
    const check = validateAttendanceDate(date, session);
    if (!check.ok) throw new BadRequestException(check.message);
  }

  async getGrid(
    organizationId: string,
    campusId: string,
    sectionId: string,
    sessionId: string,
    date: string,
    actor?: { role: string; userId: string },
  ) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, grade: { organizationId, campusId } },
      include: { grade: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    const session = await this.prisma.academicSession.findFirst({
      where: { id: sessionId, organizationId, campusId },
    });
    if (!session) throw new NotFoundException('Session not found');
    this.assertAttendanceDate(date, session);

    const family = actor?.role === 'PARENT' || actor?.role === 'STUDENT';
    const studentIds = family ? await studentIdsForUser(this.prisma, organizationId, actor?.userId ?? '') : undefined;

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sectionId,
        sessionId,
        student: {
          organizationId,
          campusId,
          ...(studentIds ? { id: { in: studentIds } } : {}),
        },
      },
      include: { student: true },
      orderBy: { rollNo: 'asc' },
    });

    const day = await this.prisma.attendanceDay.findUnique({
      where: { sectionId_date: { sectionId, date: new Date(date) } },
      include: { marks: true },
    });
    const visibleDay =
      day && studentIds
        ? { ...day, marks: day.marks.filter((mark) => enrollments.some((row) => row.id === mark.enrollmentId)) }
        : day;

    const statuses = await this.prisma.attendanceStatus.findMany({
      where: { organizationId, campusId },
    });

    return {
      section,
      enrollments: enrollments.map((row) => ({ ...row, student: withoutSensitiveStudentFields(row.student) })),
      day: visibleDay,
      statuses,
    };
  }

  async mark(
    organizationId: string,
    campusId: string,
    userId: string,
    input: {
      sectionId: string;
      sessionId: string;
      date: string;
      marks?: Array<{ enrollmentId: string; statusCode: string; remark?: string }>;
    },
  ) {
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, grade: { organizationId, campusId } },
    });
    if (!section) throw new NotFoundException('Section not found');

    const session = await this.prisma.academicSession.findFirst({
      where: { id: input.sessionId, organizationId, campusId },
    });
    if (!session) throw new NotFoundException('Session not found');
    this.assertAttendanceDate(input.date, session);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sectionId: input.sectionId,
        sessionId: input.sessionId,
        student: { organizationId, campusId },
      },
      select: { id: true },
      orderBy: { rollNo: 'asc' },
    });
    const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
    const enrollmentIdSet = new Set(enrollmentIds);

    const statuses = await this.prisma.attendanceStatus.findMany({
      where: { organizationId, campusId },
    });
    const knownCodes = new Set(statuses.map((status) => status.code));
    const presentCode = presentStatusCode(statuses);
    if (!presentCode) throw new BadRequestException('No present status is configured for this campus');

    const incoming = input.marks ?? [];
    for (const mark of incoming) {
      if (!enrollmentIdSet.has(mark.enrollmentId)) {
        throw new BadRequestException('Enrollment is not in this class');
      }
      if (!knownCodes.has(mark.statusCode)) {
        throw new BadRequestException(`Unknown attendance status: ${mark.statusCode}`);
      }
    }

    const roster = completeAttendanceRoster(enrollmentIds, incoming, presentCode);
    const dayDate = new Date(input.date);
    const existingDay = await this.prisma.attendanceDay.findUnique({
      where: { sectionId_date: { sectionId: input.sectionId, date: dayDate } },
    });
    if (existingDay?.locked) throw new ForbiddenException('Attendance for this day is locked');

    const day = await this.prisma.$transaction(async (tx) => {
      const savedDay = await tx.attendanceDay.upsert({
        where: {
          sectionId_date: { sectionId: input.sectionId, date: dayDate },
        },
        create: {
          sectionId: input.sectionId,
          sessionId: input.sessionId,
          date: dayDate,
        },
        update: {},
      });

      for (const mark of roster) {
        await tx.attendanceMark.upsert({
          where: {
            dayId_enrollmentId: { dayId: savedDay.id, enrollmentId: mark.enrollmentId },
          },
          create: {
            dayId: savedDay.id,
            enrollmentId: mark.enrollmentId,
            statusCode: mark.statusCode,
            remark: mark.remark,
          },
          update: {
            statusCode: mark.statusCode,
            ...(mark.remark !== undefined ? { remark: mark.remark } : {}),
          },
        });
      }

      return savedDay;
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'MARK_ATTENDANCE',
      entityType: 'AttendanceDay',
      entityId: day.id,
      meta: { count: roster.length, exceptions: incoming.length, date: input.date },
    });

    return this.getGrid(organizationId, campusId, input.sectionId, input.sessionId, input.date);
  }

  async rateForEnrollment(
    organizationId: string,
    enrollmentId: string,
    actor?: { role: string; userId: string },
  ) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, student: { organizationId } },
      include: {
        marks: true,
        section: { include: { grade: true } },
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (actor?.role === 'PARENT' || actor?.role === 'STUDENT') {
      const studentIds = await studentIdsForUser(this.prisma, organizationId, actor.userId);
      if (!studentIds.includes(enrollment.studentId)) {
        throw new ForbiddenException('That attendance record is not linked to this login');
      }
    }
    const statuses = await this.prisma.attendanceStatus.findMany({
      where: { organizationId, campusId: enrollment.section.grade.campusId },
    });
    return {
      percentage: attendancePercentage(
        enrollment.marks.map((m) => ({ statusCode: m.statusCode })),
        statuses,
      ),
      marksCount: enrollment.marks.length,
    };
  }

  async summaryForActor(organizationId: string, campusId: string, role: string, userId: string) {
    const family = role === 'PARENT' || role === 'STUDENT';
    const studentIds = family ? await studentIdsForUser(this.prisma, organizationId, userId) : undefined;
    return this.campusSummary(organizationId, campusId, 14, studentIds);
  }

  async campusSummary(
    organizationId: string,
    campusId: string,
    days = 14,
    studentIds?: string[],
  ) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const marks = await this.prisma.attendanceMark.findMany({
      where: {
        day: {
          date: { gte: since },
          section: { grade: { organizationId, campusId } },
        },
        ...(studentIds ? { enrollment: { studentId: { in: studentIds } } } : {}),
      },
      include: { day: true },
    });
    const statuses = await this.prisma.attendanceStatus.findMany({
      where: { organizationId, campusId },
    });
    const byDate = new Map<string, Array<{ statusCode: string }>>();
    for (const mark of marks) {
      const key = mark.day.date.toISOString().slice(0, 10);
      const list = byDate.get(key) ?? [];
      list.push({ statusCode: mark.statusCode });
      byDate.set(key, list);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayMarks]) => ({
        date,
        percentage: attendancePercentage(dayMarks, statuses),
        count: dayMarks.length,
      }));
  }
}
