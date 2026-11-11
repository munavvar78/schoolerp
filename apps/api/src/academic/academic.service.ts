import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listSessions(organizationId: string, campusId: string) {
    return this.prisma.academicSession.findMany({
      where: { organizationId, campusId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createSession(
    organizationId: string,
    campusId: string,
    userId: string,
    input: { name: string; startDate: string; endDate: string; isCurrent?: boolean },
  ) {
    if (input.isCurrent) {
      await this.prisma.academicSession.updateMany({
        where: { campusId, organizationId },
        data: { isCurrent: false },
      });
    }
    const session = await this.prisma.academicSession.create({
      data: {
        organizationId,
        campusId,
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        isCurrent: input.isCurrent ?? false,
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'AcademicSession',
      entityId: session.id,
    });
    return session;
  }

  listGrades(organizationId: string, campusId: string) {
    return this.prisma.grade.findMany({
      where: { organizationId, campusId },
      include: { sections: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  createGrade(
    organizationId: string,
    campusId: string,
    input: { name: string; sortOrder?: number },
  ) {
    return this.prisma.grade.create({
      data: {
        organizationId,
        campusId,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async createSection(organizationId: string, input: { gradeId: string; name: string; capacity?: number }) {
    const grade = await this.prisma.grade.findFirst({
      where: { id: input.gradeId, organizationId },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    return this.prisma.section.create({
      data: {
        gradeId: input.gradeId,
        name: input.name,
        capacity: input.capacity,
      },
    });
  }

  listSubjects(organizationId: string, campusId: string) {
    return this.prisma.subject.findMany({
      where: { organizationId, campusId },
      orderBy: { name: 'asc' },
    });
  }

  createSubject(
    organizationId: string,
    campusId: string,
    input: { name: string; code: string; gradeId?: string },
  ) {
    return this.prisma.subject.create({
      data: {
        organizationId,
        campusId,
        name: input.name,
        code: input.code,
        gradeId: input.gradeId,
      },
    });
  }

  listAttendanceStatuses(organizationId: string, campusId: string) {
    return this.prisma.attendanceStatus.findMany({ where: { organizationId, campusId } });
  }

  createAttendanceStatus(
    organizationId: string,
    campusId: string,
    input: {
      code: string;
      label: string;
      countsAsPresent: boolean;
      weight?: number;
      color?: string;
    },
  ) {
    return this.prisma.attendanceStatus.create({
      data: {
        organizationId,
        campusId,
        code: input.code,
        label: input.label,
        countsAsPresent: input.countsAsPresent,
        weight: input.weight ?? 1,
        color: input.color,
      },
    });
  }

  listGradeScales(organizationId: string, campusId: string) {
    return this.prisma.gradeScale.findMany({ where: { organizationId, campusId } });
  }

  createGradeScale(
    organizationId: string,
    campusId: string,
    input: { name: string; passPercent?: number; bands: unknown },
  ) {
    return this.prisma.gradeScale.create({
      data: {
        organizationId,
        campusId,
        name: input.name,
        passPercent: input.passPercent ?? 33,
        bands: input.bands as object,
      },
    });
  }

  listFieldDefinitions(organizationId: string, campusId: string, entityType?: string) {
    return this.prisma.fieldDefinition.findMany({
      where: { organizationId, campusId, ...(entityType ? { entityType } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
  }

  createFieldDefinition(
    organizationId: string,
    campusId: string,
    input: {
      entityType: string;
      key: string;
      label: string;
      fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN' | 'TEXTAREA';
      required?: boolean;
      options?: string[];
      sensitive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.prisma.fieldDefinition.create({
      data: {
        organizationId,
        campusId,
        entityType: input.entityType,
        key: input.key,
        label: input.label,
        fieldType: input.fieldType,
        required: input.required ?? false,
        options: input.options ?? [],
        sensitive: input.sensitive ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  getCampus(organizationId: string, campusId: string) {
    return this.prisma.campus.findFirst({
      where: { id: campusId, organizationId },
      include: {
        organization: true,
      },
    });
  }

  listRuleConfigs(organizationId: string, campusId: string) {
    return this.prisma.ruleConfig.findMany({ where: { organizationId, campusId } });
  }
}
