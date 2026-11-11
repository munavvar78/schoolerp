import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { assertMarkWithinMax, gradeFromScale, weightedTotal, type GradeBand } from '@school-erp/shared';
import { AuditService } from '../common/audit.service.js';
import { studentIdsForUser, withoutSensitiveStudentFields } from '../common/family.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organizationId: string, campusId: string) {
    return this.prisma.exam.findMany({
      where: { organizationId, campusId },
      include: {
        components: { include: { subject: true } },
        grade: true,
        session: true,
        publications: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForActor(organizationId: string, campusId: string, role: string, userId: string) {
    const exams = await this.list(organizationId, campusId);
    if (role !== 'PARENT' && role !== 'STUDENT') return exams;
    const studentIds = await studentIdsForUser(this.prisma, organizationId, userId);
    if (!studentIds.length) return [];
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: { in: studentIds }, student: { organizationId } },
      select: { sessionId: true, section: { select: { gradeId: true } } },
    });
    const gradeIds = new Set(enrollments.map((row) => row.section.gradeId));
    const sessionIds = new Set(enrollments.map((row) => row.sessionId));
    return exams.filter(
      (exam) =>
        (exam.publishedAt != null || exam.publications.length > 0) &&
        gradeIds.has(exam.gradeId) &&
        sessionIds.has(exam.sessionId),
    );
  }

  async create(
    organizationId: string,
    campusId: string,
    userId: string,
    input: {
      name: string;
      sessionId: string;
      gradeId: string;
      startDate?: string;
      endDate?: string;
      components: Array<{
        name: string;
        maxMarks: number;
        weight: number;
        subjectId?: string;
      }>;
    },
  ) {
    const scale = await this.prisma.gradeScale.findFirst({
      where: { organizationId, campusId },
      orderBy: { name: 'asc' },
    });
    const exam = await this.prisma.exam.create({
      data: {
        organizationId,
        campusId,
        name: input.name,
        sessionId: input.sessionId,
        gradeId: input.gradeId,
        gradeScaleId: scale?.id,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        components: {
          create: input.components,
        },
      },
      include: { components: true },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'Exam',
      entityId: exam.id,
    });
    return exam;
  }

  async saveScores(
    organizationId: string,
    userId: string,
    input: {
      examId: string;
      scores: Array<{ enrollmentId: string; componentId: string; obtained: number | null }>;
    },
  ) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: input.examId, organizationId },
      include: { components: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    for (const score of input.scores) {
      const component = exam.components.find((item) => item.id === score.componentId);
      if (!component) throw new NotFoundException('Component mismatch');
      const mark = assertMarkWithinMax(score.obtained, component.maxMarks);
      if (!mark.ok) throw new BadRequestException(mark.message);
      await this.prisma.score.upsert({
        where: {
          componentId_enrollmentId: {
            componentId: score.componentId,
            enrollmentId: score.enrollmentId,
          },
        },
        create: {
          componentId: score.componentId,
          enrollmentId: score.enrollmentId,
          obtained: score.obtained,
        },
        update: { obtained: score.obtained },
      });
    }

    await this.audit.log({
      organizationId,
      userId,
      action: 'SAVE_SCORES',
      entityType: 'Exam',
      entityId: exam.id,
      meta: { count: input.scores.length },
    });

    return this.results(organizationId, exam.id, false);
  }

  async results(organizationId: string, examId: string, requirePublished: boolean, studentIds?: string[]) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, organizationId },
      include: {
        components: true,
        gradeScale: true,
        publications: true,
        grade: { include: { sections: true } },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (requirePublished && !exam.publishedAt && exam.publications.length === 0) {
      throw new ForbiddenException('Results not published');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sessionId: exam.sessionId,
        section: { gradeId: exam.gradeId },
        student: {
          organizationId,
          ...(studentIds ? { id: { in: studentIds } } : {}),
        },
      },
      include: {
        student: true,
        scores: { where: { component: { examId } } },
      },
    });

    const bands = (exam.gradeScale?.bands ?? []) as unknown as GradeBand[];
    const passPercent = exam.gradeScale?.passPercent ?? 33;

    return enrollments.map((enrollment) => {
      const componentScores = exam.components.map((c) => {
        const score = enrollment.scores.find((s) => s.componentId === c.id);
        return {
          maxMarks: c.maxMarks,
          weight: c.weight,
          obtained: score?.obtained ?? null,
        };
      });
      const totals = weightedTotal(componentScores);
      const grade = gradeFromScale(totals.percentage, bands, passPercent);
      return {
        enrollmentId: enrollment.id,
        student: withoutSensitiveStudentFields(enrollment.student),
        totals,
        grade,
        scores: enrollment.scores,
      };
    });
  }

  async publish(organizationId: string, userId: string, examId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, organizationId } });
    if (!exam) throw new NotFoundException('Exam not found');
    const updated = await this.prisma.exam.update({
      where: { id: examId },
      data: { publishedAt: new Date() },
    });
    await this.prisma.resultPublication.create({
      data: { examId, publishedBy: userId },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'PUBLISH_RESULTS',
      entityType: 'Exam',
      entityId: examId,
    });
    return updated;
  }

  async resultsForActor(organizationId: string, examId: string, role: string, userId: string) {
    const family = role === 'PARENT' || role === 'STUDENT';
    const studentIds = family ? await studentIdsForUser(this.prisma, organizationId, userId) : undefined;
    return this.results(organizationId, examId, family, studentIds);
  }

  async averagesForActor(organizationId: string, campusId: string, role: string, userId: string) {
    const family = role === 'PARENT' || role === 'STUDENT';
    const studentIds = family ? await studentIdsForUser(this.prisma, organizationId, userId) : undefined;
    return this.subjectAverages(organizationId, campusId, studentIds);
  }

  async subjectAverages(organizationId: string, campusId: string, studentIds?: string[]) {
    const exams = await this.prisma.exam.findMany({
      where: {
        organizationId,
        campusId,
        ...(studentIds
          ? { OR: [{ publishedAt: { not: null } }, { publications: { some: {} } }] }
          : {}),
      },
      include: {
        components: {
          include: {
            subject: true,
            scores: studentIds
              ? { where: { enrollment: { studentId: { in: studentIds } } } }
              : true,
          },
        },
      },
    });
    const map = new Map<string, { subject: string; total: number; count: number }>();
    for (const exam of exams) {
      for (const component of exam.components) {
        const key = component.subject?.name ?? component.name;
        const bucket = map.get(key) ?? { subject: key, total: 0, count: 0 };
        for (const score of component.scores) {
          if (score.obtained == null) continue;
          bucket.total += (score.obtained / component.maxMarks) * 100;
          bucket.count += 1;
        }
        map.set(key, bucket);
      }
    }
    return [...map.values()].map((b) => ({
      subject: b.subject,
      average: b.count ? Math.round((b.total / b.count) * 100) / 100 : 0,
    }));
  }
}
