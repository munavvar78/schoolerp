import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canTransitionAdmission,
  nextAdmissionNumber,
  type AdmissionStatus,
  type ConvertAdmissionInput,
  type CreateAdmissionInput,
  type TransitionAdmissionInput,
} from '@school-erp/shared';
import { Prisma } from '@school-erp/database';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    organizationId: string,
    campusId: string,
    query?: { status?: string; sessionId?: string },
  ) {
    return this.prisma.admissionApplication.findMany({
      where: {
        organizationId,
        campusId,
        ...(query?.status ? { status: query.status as AdmissionStatus } : {}),
        ...(query?.sessionId ? { sessionId: query.sessionId } : {}),
      },
      include: {
        grade: true,
        session: true,
        events: { orderBy: { createdAt: 'desc' }, take: 5 },
        student: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
  }

  async create(
    organizationId: string,
    campusId: string,
    userId: string,
    input: CreateAdmissionInput,
  ) {
    const session = await this.prisma.academicSession.findFirst({
      where: { id: input.sessionId, organizationId, campusId },
    });
    if (!session) throw new NotFoundException('Session not found');
    const grade = await this.prisma.grade.findFirst({
      where: { id: input.gradeId, organizationId, campusId },
    });
    if (!grade) throw new NotFoundException('Grade not found');

    const feeRule = await this.prisma.ruleConfig.findFirst({
      where: { organizationId, campusId, key: 'admission_fee' },
      orderBy: { version: 'desc' },
    });
    const feePaise =
      typeof feeRule?.value === 'object' &&
      feeRule.value &&
      'amountPaise' in (feeRule.value as object)
        ? Number((feeRule.value as { amountPaise: number }).amountPaise)
        : 0;

    const status: AdmissionStatus = input.submit ? 'SUBMITTED' : 'DRAFT';
    const app = await this.prisma.admissionApplication.create({
      data: {
        organizationId,
        campusId,
        sessionId: input.sessionId,
        gradeId: input.gradeId,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail || null,
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
        status,
        admissionFeePaise: feePaise,
        events: {
          create: {
            fromStatus: null,
            toStatus: status,
            actorUserId: userId,
            note: input.submit ? 'Submitted' : 'Draft created',
          },
        },
      },
      include: { grade: true, session: true, events: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'AdmissionApplication',
      entityId: app.id,
    });
    return app;
  }

  async transition(
    organizationId: string,
    userId: string,
    input: TransitionAdmissionInput,
  ) {
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id: input.applicationId, organizationId },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (!canTransitionAdmission(app.status as AdmissionStatus, input.status)) {
      throw new BadRequestException(
        `Cannot transition from ${app.status} to ${input.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.admissionApplication.update({
        where: { id: app.id },
        data: { status: input.status },
        include: { grade: true, session: true, events: true },
      });
      await tx.admissionEvent.create({
        data: {
          applicationId: app.id,
          fromStatus: app.status,
          toStatus: input.status,
          note: input.note,
          actorUserId: userId,
        },
      });
      return next;
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'TRANSITION',
      entityType: 'AdmissionApplication',
      entityId: app.id,
      meta: { from: app.status, to: input.status },
    });
    return updated;
  }

  async recordFee(
    organizationId: string,
    userId: string,
    input: {
      applicationId: string;
      amountPaise: number;
      method: 'CASH' | 'CHEQUE' | 'UPI' | 'BANK_TRANSFER' | 'CARD';
      reference?: string;
    },
  ) {
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id: input.applicationId, organizationId },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (!['OFFERED', 'ACCEPTED'].includes(app.status)) {
      throw new BadRequestException('Fee can be recorded after offer/accept');
    }

    const receiptNo = `ADM-FEE-${Date.now().toString().slice(-8)}`;
    const updated = await this.prisma.admissionApplication.update({
      where: { id: app.id },
      data: {
        admissionFeePaidPaise: app.admissionFeePaidPaise + input.amountPaise,
        admissionFeeMethod: input.method,
        admissionFeeReference: input.reference,
        admissionFeeReceiptNo: receiptNo,
        admissionFeePaidAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ADMISSION_FEE',
      entityType: 'AdmissionApplication',
      entityId: app.id,
      meta: { amountPaise: input.amountPaise, method: input.method, receiptNo },
    });
    return updated;
  }

  async convert(
    organizationId: string,
    campusId: string,
    userId: string,
    input: ConvertAdmissionInput,
  ) {
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id: input.applicationId, organizationId, campusId },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (!['ACCEPTED', 'OFFERED'].includes(app.status)) {
      throw new BadRequestException('Convert requires OFFERED or ACCEPTED status');
    }
    if (app.studentId) throw new BadRequestException('Already converted');

    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, grade: { organizationId, campusId, id: app.gradeId } },
    });
    if (!section) throw new NotFoundException('Section not found for grade');

    const prefixRule = await this.prisma.ruleConfig.findFirst({
      where: { organizationId, campusId, key: 'admission_number_prefix' },
      orderBy: { version: 'desc' },
    });
    const prefix =
      typeof prefixRule?.value === 'object' &&
      prefixRule.value &&
      'prefix' in (prefixRule.value as object)
        ? String((prefixRule.value as { prefix: string }).prefix)
        : 'ADM-';

    const year = new Date().getFullYear();
    const count = await this.prisma.student.count({ where: { organizationId, campusId } });
    const admissionNo =
      input.admissionNo?.trim() || nextAdmissionNumber(prefix, year, count + 1);

    const result = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          organizationId,
          campusId,
          firstName: app.firstName,
          lastName: app.lastName,
          admissionNo,
          dateOfBirth: app.dateOfBirth,
          gender: app.gender,
          customFields: app.customFields as Prisma.InputJsonValue,
        },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          sectionId: input.sectionId,
          sessionId: app.sessionId,
          rollNo: input.rollNo,
        },
      });

      if (app.contactName) {
        const guardian = await tx.guardian.create({
          data: {
            organizationId,
            name: app.contactName,
            relation: 'GUARDIAN',
            phone: app.contactPhone,
            email: app.contactEmail,
          },
        });
        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: guardian.id,
            isPrimary: true,
          },
        });
      }

      const updated = await tx.admissionApplication.update({
        where: { id: app.id },
        data: { status: 'ENROLLED', studentId: student.id },
        include: { student: true, grade: true, session: true },
      });

      await tx.admissionEvent.create({
        data: {
          applicationId: app.id,
          fromStatus: app.status,
          toStatus: 'ENROLLED',
          actorUserId: userId,
          note: `Converted to student ${admissionNo}`,
        },
      });

      return { application: updated, student, enrollment };
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CONVERT',
      entityType: 'AdmissionApplication',
      entityId: app.id,
      meta: { studentId: result.student.id, admissionNo },
    });

    return result;
  }

  async openCount(organizationId: string, campusId: string) {
    return this.prisma.admissionApplication.count({
      where: {
        organizationId,
        campusId,
        status: {
          in: ['SUBMITTED', 'UNDER_REVIEW', 'WAITLISTED', 'OFFERED', 'ACCEPTED'],
        },
      },
    });
  }

  scopeApplications(
    organizationId: string,
    campusId: string,
  ): Prisma.AdmissionApplicationWhereInput {
    return { organizationId, campusId };
  }
}
