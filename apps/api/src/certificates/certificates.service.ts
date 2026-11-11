import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@school-erp/database';
import {
  canIssueFeeClearance,
  certificateSerial,
  isVerificationCode,
  publicCertificateView,
  type CertificateType,
  type Role,
} from '@school-erp/shared';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../common/audit.service.js';
import { studentIdsForUser } from '../common/family.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FeesService } from '../fees/fees.service.js';

const ISSUE_ROLES: Role[] = ['ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT', 'PLATFORM_OPERATOR'];

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fees: FeesService,
  ) {}

  async list(organizationId: string, campusId: string, role: Role, userId: string) {
    const studentIds =
      role === 'PARENT' || role === 'STUDENT'
        ? await studentIdsForUser(this.prisma, organizationId, userId)
        : null;
    return this.prisma.certificate.findMany({
      where: {
        organizationId,
        campusId,
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
  }

  async issue(
    organizationId: string,
    campusId: string,
    userId: string,
    role: Role,
    input: {
      studentId: string;
      type: CertificateType;
      purpose: string;
      reason?: string;
      conduct?: string;
      leavingDate?: string;
    },
  ) {
    if (!ISSUE_ROLES.includes(role)) throw new BadRequestException('You cannot issue certificates');
    if (role === 'ACCOUNTANT' && input.type !== 'FEE_CLEARANCE') {
      throw new BadRequestException('Accounts can issue fee-clearance certificates only');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, organizationId, campusId, isActive: true },
      include: {
        campus: true,
        enrollments: {
          include: { section: { include: { grade: true } }, session: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (input.type === 'FEE_CLEARANCE') {
      const dues = await this.fees.outstanding(organizationId, campusId);
      const outstanding = dues
        .filter((row) => row.enrollment.studentId === student.id)
        .reduce((sum, row) => sum + row.outstandingPaise, 0);
      if (!canIssueFeeClearance(outstanding)) {
        throw new BadRequestException('Fee clearance needs a zero balance');
      }
    }

    const enrollment = student.enrollments[0];
    const payload = {
      studentName: [student.firstName, student.lastName].filter(Boolean).join(' '),
      admissionNo: student.admissionNo,
      dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      className: enrollment ? `${enrollment.section.grade.name} ${enrollment.section.name}` : null,
      sessionName: enrollment?.session.name ?? null,
      purpose: input.purpose,
      reason: input.reason ?? null,
      conduct: input.conduct ?? null,
      leavingDate: input.leavingDate ?? null,
      campusName: student.campus.name,
    };

    const year = new Date().getFullYear();
    const verificationCode = randomBytes(32).toString('hex');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const count = await this.prisma.certificate.count({
        where: { organizationId, serialNo: { startsWith: `CERT-${year}-` } },
      });
      const serialNo = certificateSerial(year, count + 1 + attempt);
      try {
        const certificate = await this.prisma.certificate.create({
          data: {
            organizationId,
            campusId,
            studentId: student.id,
            type: input.type,
            serialNo,
            verificationCode,
            purpose: input.purpose,
            payload: payload as Prisma.InputJsonValue,
            issuedByUserId: userId,
          },
          include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
        });
        await this.audit.log({
          organizationId,
          userId,
          action: 'ISSUE_CERTIFICATE',
          entityType: 'Certificate',
          entityId: certificate.id,
          meta: { type: input.type, serialNo },
        });
        return certificate;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || attempt === 2) {
          throw error;
        }
      }
    }
    throw new BadRequestException('Could not allocate a certificate serial');
  }

  async revoke(organizationId: string, campusId: string, userId: string, certificateId: string) {
    const certificate = await this.prisma.certificate.findFirst({
      where: { id: certificateId, organizationId, campusId },
    });
    if (!certificate) throw new NotFoundException('Certificate not found');
    if (certificate.revokedAt) return certificate;
    const revoked = await this.prisma.certificate.update({
      where: { id: certificate.id },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'REVOKE_CERTIFICATE',
      entityType: 'Certificate',
      entityId: certificate.id,
    });
    return revoked;
  }

  async verify(code: string) {
    if (!isVerificationCode(code)) throw new NotFoundException('Certificate not found');
    const certificate = await this.prisma.certificate.findFirst({
      where: { verificationCode: code },
      include: { student: true, campus: true },
    });
    if (!certificate) throw new NotFoundException('Certificate not found');
    return publicCertificateView({
      type: certificate.type,
      serialNo: certificate.serialNo,
      issuedAt: certificate.issuedAt.toISOString(),
      revokedAt: certificate.revokedAt?.toISOString() ?? null,
      studentFirstName: certificate.student.firstName,
      studentLastName: certificate.student.lastName,
      campusName: certificate.campus.name,
    });
  }
}
