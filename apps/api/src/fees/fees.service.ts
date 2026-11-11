import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeLateFeePaise,
  feeDemandTotalPaise,
  outstandingPaise,
  paymentWithinOutstanding,
  type LateFeeConfig,
  type Role,
} from '@school-erp/shared';
import { AuditService } from '../common/audit.service.js';
import { studentIdsForUser, withoutSensitiveStudentFields } from '../common/family.js';
import { PrismaService } from '../prisma/prisma.service.js';

type PaymentMethodInput = 'CASH' | 'CHEQUE' | 'UPI' | 'BANK_TRANSFER' | 'CARD';

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listHeads(organizationId: string, campusId: string) {
    return this.prisma.feeHead.findMany({ where: { organizationId, campusId } });
  }

  createHead(
    organizationId: string,
    campusId: string,
    input: {
      name: string;
      code: string;
      cycle?: 'MONTHLY' | 'QUARTERLY' | 'TERM' | 'ANNUAL';
      gstTreatment?: 'EXEMPT' | 'TAXABLE';
      gstRateBps?: number;
    },
  ) {
    return this.prisma.feeHead.create({
      data: {
        organizationId,
        campusId,
        name: input.name,
        code: input.code,
        cycle: input.cycle ?? 'MONTHLY',
        gstTreatment: input.gstTreatment ?? 'EXEMPT',
        gstRateBps: input.gstRateBps ?? 0,
      },
    });
  }

  listStructures(organizationId: string, campusId: string) {
    return this.prisma.feeStructure.findMany({
      where: { organizationId, campusId },
      include: { lines: { include: { feeHead: true } }, grade: true, session: true },
    });
  }

  createStructure(
    organizationId: string,
    campusId: string,
    input: {
      name: string;
      gradeId: string;
      sessionId: string;
      lines: Array<{ feeHeadId: string; amountPaise: number }>;
    },
  ) {
    return this.prisma.feeStructure.create({
      data: {
        organizationId,
        campusId,
        name: input.name,
        gradeId: input.gradeId,
        sessionId: input.sessionId,
        lines: { create: input.lines },
      },
      include: { lines: true },
    });
  }

  async generateDemands(
    organizationId: string,
    userId: string,
    input: {
      feeStructureId: string;
      periodLabel: string;
      dueDate: string;
      sectionId?: string;
    },
  ) {
    const structure = await this.prisma.feeStructure.findFirst({
      where: { id: input.feeStructureId, organizationId },
      include: { lines: true, grade: { include: { sections: true } } },
    });
    if (!structure) throw new NotFoundException('Fee structure not found');

    const sectionIds = input.sectionId
      ? [input.sectionId]
      : structure.grade.sections.map((s) => s.id);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sessionId: structure.sessionId,
        sectionId: { in: sectionIds },
        student: { organizationId },
      },
    });

    const totalPaise = feeDemandTotalPaise(
      structure.lines.map((l) => ({ amountPaise: l.amountPaise })),
    );

    const created = [];
    for (const enrollment of enrollments) {
      const demand = await this.prisma.feeDemand.upsert({
        where: {
          enrollmentId_feeStructureId_periodLabel: {
            enrollmentId: enrollment.id,
            feeStructureId: structure.id,
            periodLabel: input.periodLabel,
          },
        },
        create: {
          organizationId,
          feeStructureId: structure.id,
          enrollmentId: enrollment.id,
          periodLabel: input.periodLabel,
          dueDate: new Date(input.dueDate),
          totalPaise,
        },
        update: {
          dueDate: new Date(input.dueDate),
          totalPaise,
        },
      });
      created.push(demand);
    }

    await this.audit.log({
      organizationId,
      userId,
      action: 'GENERATE_DEMANDS',
      entityType: 'FeeDemand',
      meta: { count: created.length, periodLabel: input.periodLabel },
    });

    return created;
  }

  async outstanding(
    organizationId: string,
    campusId: string,
    scope?: { role: Role; userId: string },
  ) {
    const family = scope?.role === 'PARENT' || scope?.role === 'STUDENT';
    const studentIds =
      family && scope
        ? await studentIdsForUser(this.prisma, organizationId, scope.userId)
        : null;
    const demands = await this.prisma.feeDemand.findMany({
      where: {
        organizationId,
        enrollment: {
          student: {
            campusId,
            ...(studentIds ? { id: { in: studentIds } } : {}),
          },
        },
      },
      include: {
        payments: true,
        enrollment: { include: { student: true, section: { include: { grade: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const lateRule = await this.prisma.ruleConfig.findFirst({
      where: { organizationId, campusId, key: 'late_fee' },
      orderBy: { version: 'desc' },
    });
    const lateConfig = (lateRule?.value ?? {
      fixedPaise: 0,
      percent: 0,
      graceDays: 7,
    }) as unknown as LateFeeConfig;

    const asOf = new Date();
    return demands.map((d) => {
      const paid = d.payments.reduce((s, p) => s + p.amountPaise, 0);
      const baseOutstanding = Math.max(0, d.totalPaise - d.concessionPaise - paid);
      const lateFeePaise = computeLateFeePaise(baseOutstanding, d.dueDate, asOf, lateConfig);
      const enrollment = d.enrollment?.student
        ? { ...d.enrollment, student: withoutSensitiveStudentFields(d.enrollment.student) }
        : d.enrollment;
      return {
        ...d,
        enrollment,
        paidPaise: paid,
        lateFeePaise,
        outstandingPaise: outstandingPaise(d.totalPaise - d.concessionPaise, paid, lateFeePaise),
      };
    });
  }

  async recordPayment(
    organizationId: string,
    campusId: string,
    userId: string | null,
    input: {
      feeDemandId: string;
      amountPaise: number;
      method: PaymentMethodInput;
      reference?: string;
      paidAt?: string;
    },
  ) {
    const demand = await this.prisma.feeDemand.findFirst({
      where: {
        id: input.feeDemandId,
        organizationId,
        enrollment: { student: { campusId } },
      },
    });
    if (!demand) throw new NotFoundException('Fee demand not found');

    const rows = await this.outstanding(organizationId, campusId);
    const row = rows.find((item) => item.id === demand.id);
    const allowed = paymentWithinOutstanding(input.amountPaise, row?.outstandingPaise ?? -1);
    if (!row || !allowed.ok) {
      throw new BadRequestException('message' in allowed ? allowed.message : 'Amount exceeds outstanding dues');
    }

    const count = await this.prisma.payment.count({ where: { organizationId } });
    const receiptNo = `RCPT-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        feeDemandId: input.feeDemandId,
        amountPaise: input.amountPaise,
        method: input.method,
        reference: input.reference,
        receiptNo,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'RECORD_PAYMENT',
      entityType: 'Payment',
      entityId: payment.id,
      meta: { amountPaise: input.amountPaise, method: input.method },
    });

    return payment;
  }

  async collectionSummary(
    organizationId: string,
    campusId: string,
    scope?: { role: Role; userId: string },
  ) {
    const demands = await this.outstanding(organizationId, campusId, scope);
    const demandTotal = demands.reduce((s, d) => s + (d.totalPaise - d.concessionPaise), 0);
    const collected = demands.reduce((s, d) => s + d.paidPaise, 0);
    const outstanding = demands.reduce((s, d) => s + d.outstandingPaise, 0);
    return { demandTotal, collected, outstanding, count: demands.length };
  }
}
