import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@school-erp/database';
import {
  composeWarningsExceededMessage,
  generateJoinCode,
  gradeMcqAnswerScaled,
  hardLockMessage,
  isProctorHardLockType,
  isProctorTabBlockType,
  isProctorWarningType,
  stripCorrectFlags,
  warningCauseLabel,
  type McqOption,
} from '@school-erp/shared';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../common/audit.service.js';
import { appConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

type QuestionInput = {
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'YES_NO' | 'THIS_OR_THAT' | 'MCQ' | 'SHORT_TEXT';
  stem: string;
  marks: number;
  sortOrder: number;
  options: McqOption[];
};

type CreateInput = {
  title: string;
  sessionId: string;
  startsAt?: string;
  endsAt?: string;
  durationMinutes: number;
  pin?: string;
  requireCamera: boolean;
  maxWarnings: number;
  faceAbsentSeconds: number;
  shuffleQuestions: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'CLOSED';
  questions: QuestionInput[];
};

@Injectable()
export class OnlineAssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
  ) {}

  list(organizationId: string, campusId: string) {
    return this.prisma.onlineAssessment.findMany({
      where: { organizationId, campusId },
      include: {
        session: true,
        _count: { select: { questions: true, enrollments: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(organizationId: string, campusId: string, id: string) {
    const assessment = await this.prisma.onlineAssessment.findFirst({
      where: { id, organizationId, campusId },
      include: {
        session: true,
        questions: { orderBy: { sortOrder: 'asc' } },
        enrollments: {
          include: {
            enrollment: {
              include: {
                student: true,
                section: { include: { grade: true } },
              },
            },
          },
        },
        attempts: {
          include: {
            enrollment: { include: { student: true } },
            proctorEvents: { orderBy: { at: 'desc' }, take: 20 },
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async create(
    organizationId: string,
    campusId: string,
    userId: string,
    input: CreateInput,
  ) {
    const session = await this.prisma.academicSession.findFirst({
      where: { id: input.sessionId, organizationId, campusId },
    });
    if (!session) throw new NotFoundException('Session not found');

    let joinCode = generateJoinCode();
    for (let i = 0; i < 5; i += 1) {
      const clash = await this.prisma.onlineAssessment.findFirst({
        where: { campusId, joinCode },
      });
      if (!clash) break;
      joinCode = generateJoinCode();
    }

    const pinHash = input.pin ? await argon2.hash(input.pin) : null;

    const assessment = await this.prisma.onlineAssessment.create({
      data: {
        organizationId,
        campusId,
        sessionId: input.sessionId,
        title: input.title,
        joinCode,
        pinHash,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        durationMinutes: input.durationMinutes,
        requireCamera: input.requireCamera,
        maxWarnings: input.maxWarnings,
        faceAbsentSeconds: input.faceAbsentSeconds,
        shuffleQuestions: input.shuffleQuestions,
        status: input.status,
        questions: {
          create: (input.questions ?? []).map((q, index) => ({
            type: q.type,
            stem: q.stem,
            marks: q.marks,
            sortOrder: q.sortOrder ?? index,
            options: q.options as unknown as Prisma.InputJsonValue,
          })),
        },
      },
      include: { questions: true, session: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'OnlineAssessment',
      entityId: assessment.id,
    });

    return assessment;
  }

  async addQuestion(
    organizationId: string,
    campusId: string,
    userId: string,
    assessmentId: string,
    question: QuestionInput,
  ) {
    const assessment = await this.prisma.onlineAssessment.findFirst({
      where: { id: assessmentId, organizationId, campusId },
      include: { questions: { select: { sortOrder: true } } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const maxOrder = assessment.questions.reduce((m, q) => Math.max(m, q.sortOrder), -1);
    const created = await this.prisma.onlineQuestion.create({
      data: {
        assessmentId,
        type: question.type,
        stem: question.stem,
        marks: question.marks,
        sortOrder: question.sortOrder ?? maxOrder + 1,
        options: question.options as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ADD_QUESTION',
      entityType: 'OnlineAssessment',
      entityId: assessmentId,
      meta: { questionId: created.id, type: created.type },
    });

    return created;
  }

  async updateQuestion(
    organizationId: string,
    campusId: string,
    userId: string,
    assessmentId: string,
    questionId: string,
    question: QuestionInput,
  ) {
    const existing = await this.prisma.onlineQuestion.findFirst({
      where: {
        id: questionId,
        assessmentId,
        assessment: { organizationId, campusId },
      },
    });
    if (!existing) throw new NotFoundException('Question not found');

    const updated = await this.prisma.onlineQuestion.update({
      where: { id: questionId },
      data: {
        type: question.type,
        stem: question.stem,
        marks: question.marks,
        sortOrder: question.sortOrder,
        options: question.options as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE_QUESTION',
      entityType: 'OnlineAssessment',
      entityId: assessmentId,
      meta: { questionId, type: updated.type },
    });

    return updated;
  }

  async deleteQuestion(
    organizationId: string,
    campusId: string,
    userId: string,
    assessmentId: string,
    questionId: string,
  ) {
    const existing = await this.prisma.onlineQuestion.findFirst({
      where: {
        id: questionId,
        assessmentId,
        assessment: { organizationId, campusId },
      },
    });
    if (!existing) throw new NotFoundException('Question not found');

    await this.prisma.onlineQuestion.delete({ where: { id: questionId } });

    await this.audit.log({
      organizationId,
      userId,
      action: 'DELETE_QUESTION',
      entityType: 'OnlineAssessment',
      entityId: assessmentId,
      meta: { questionId },
    });

    return { ok: true };
  }

  async setStatus(
    organizationId: string,
    campusId: string,
    userId: string,
    assessmentId: string,
    status: CreateInput['status'],
  ) {
    const existing = await this.prisma.onlineAssessment.findFirst({
      where: { id: assessmentId, organizationId, campusId },
    });
    if (!existing) throw new NotFoundException('Assessment not found');
    const updated = await this.prisma.onlineAssessment.update({
      where: { id: assessmentId },
      data: { status },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE_STATUS',
      entityType: 'OnlineAssessment',
      entityId: assessmentId,
      meta: { status },
    });
    return updated;
  }

  async updateSettings(
    organizationId: string,
    campusId: string,
    userId: string,
    assessmentId: string,
    input: {
      title?: string;
      durationMinutes?: number;
      requireCamera?: boolean;
      maxWarnings?: number;
      faceAbsentSeconds?: number;
    },
  ) {
    const existing = await this.prisma.onlineAssessment.findFirst({
      where: { id: assessmentId, organizationId, campusId },
    });
    if (!existing) throw new NotFoundException('Assessment not found');

    const updated = await this.prisma.onlineAssessment.update({
      where: { id: assessmentId },
      data: {
        ...(input.title != null ? { title: input.title } : {}),
        ...(input.durationMinutes != null ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.requireCamera != null ? { requireCamera: input.requireCamera } : {}),
        ...(input.maxWarnings != null ? { maxWarnings: input.maxWarnings } : {}),
        ...(input.faceAbsentSeconds != null ? { faceAbsentSeconds: input.faceAbsentSeconds } : {}),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE_SETTINGS',
      entityType: 'OnlineAssessment',
      entityId: assessmentId,
      meta: input as Record<string, unknown>,
    });

    return updated;
  }

  async deleteAssessment(
    organizationId: string,
    campusId: string,
    userId: string,
    assessmentId: string,
  ) {
    const existing = await this.prisma.onlineAssessment.findFirst({
      where: { id: assessmentId, organizationId, campusId },
    });
    if (!existing) throw new NotFoundException('Assessment not found');

    await this.prisma.onlineAssessment.delete({ where: { id: assessmentId } });

    await this.audit.log({
      organizationId,
      userId,
      action: 'DELETE',
      entityType: 'OnlineAssessment',
      entityId: assessmentId,
      meta: { title: existing.title },
    });

    return { ok: true };
  }

  async enrollSection(
    organizationId: string,
    campusId: string,
    userId: string,
    assessmentId: string,
    sectionId: string,
  ) {
    const assessment = await this.prisma.onlineAssessment.findFirst({
      where: { id: assessmentId, organizationId, campusId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, grade: { organizationId, campusId } },
    });
    if (!section) throw new NotFoundException('Section not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sectionId,
        sessionId: assessment.sessionId,
        student: { organizationId, campusId, isActive: true },
      },
    });

    let created = 0;
    for (const enrollment of enrollments) {
      try {
        await this.prisma.onlineAssessmentEnrollment.create({
          data: {
            assessmentId,
            enrollmentId: enrollment.id,
            joinToken: randomBytes(16).toString('hex'),
          },
        });
        created += 1;
      } catch {
        // unique violation — already enrolled
      }
    }

    await this.audit.log({
      organizationId,
      userId,
      action: 'ENROLL_SECTION',
      entityType: 'OnlineAssessment',
      entityId: assessmentId,
      meta: { sectionId, created, total: enrollments.length },
    });

    return { created, totalEligible: enrollments.length };
  }

  async join(input: { joinCode: string; admissionNo: string; pin?: string }) {
    const assessment = await this.prisma.onlineAssessment.findFirst({
      where: {
        joinCode: input.joinCode.trim().toUpperCase(),
        status: { in: ['LIVE', 'SCHEDULED'] },
      },
      include: { questions: true },
    });
    if (!assessment) throw new NotFoundException('Exam not found or not open');

    const now = new Date();
    if (assessment.startsAt && now < assessment.startsAt) {
      throw new BadRequestException('Exam has not started yet');
    }
    if (assessment.endsAt && now > assessment.endsAt) {
      throw new BadRequestException('Exam window has ended');
    }
    if (assessment.status === 'SCHEDULED' && !assessment.startsAt) {
      // allow join when marked scheduled without window — treat as open
    }

    if (assessment.pinHash) {
      if (!input.pin) throw new UnauthorizedException('PIN required');
      const ok = await argon2.verify(assessment.pinHash, input.pin);
      if (!ok) throw new UnauthorizedException('Invalid PIN');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        organizationId: assessment.organizationId,
        campusId: assessment.campusId,
        admissionNo: { equals: input.admissionNo.trim(), mode: 'insensitive' },
        isActive: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: student.id, sessionId: assessment.sessionId },
    });
    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in this academic session');
    }

    const assessmentEnrollment = await this.prisma.onlineAssessmentEnrollment.findFirst({
      where: { assessmentId: assessment.id, enrollmentId: enrollment.id },
    });
    if (!assessmentEnrollment) {
      throw new ForbiddenException('Student is not enrolled in this online exam');
    }

    let attempt = await this.prisma.onlineAttempt.findFirst({
      where: { assessmentId: assessment.id, enrollmentId: enrollment.id },
    });

    if (attempt?.status === 'SUBMITTED') {
      throw new BadRequestException('You have already submitted this exam');
    }
    if (attempt?.status === 'VOID') {
      throw new BadRequestException('This attempt was voided by staff');
    }

    if (!attempt) {
      const expiresAt = new Date(now.getTime() + assessment.durationMinutes * 60_000);
      attempt = await this.prisma.onlineAttempt.create({
        data: {
          organizationId: assessment.organizationId,
          assessmentId: assessment.id,
          assessmentEnrollmentId: assessmentEnrollment.id,
          enrollmentId: enrollment.id,
          expiresAt,
        },
      });
    } else if (attempt.status === 'IN_PROGRESS' && attempt.expiresAt < now) {
      attempt = await this.prisma.onlineAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'LOCKED',
          lockedAt: now,
          lockReasonCode: 'TIME_EXPIRED',
          lockReasonMessage: 'Exam locked: time expired.',
        },
      });
    }

    if (assessment.status === 'SCHEDULED') {
      await this.prisma.onlineAssessment.update({
        where: { id: assessment.id },
        data: { status: 'LIVE' },
      });
    }

    const accessToken = await this.jwt.signAsync(
      {
        purpose: 'online_attempt',
        attemptId: attempt.id,
        assessmentId: assessment.id,
        organizationId: assessment.organizationId,
        campusId: assessment.campusId,
      },
      {
        secret: appConfig.jwtAccessSecret,
        expiresIn: Math.max(
          60,
          Math.ceil((attempt.expiresAt.getTime() - Date.now()) / 1000) + 300,
        ),
      },
    );

    return {
      accessToken,
      attempt: this.sanitizeAttempt(attempt),
      assessment: {
        id: assessment.id,
        title: assessment.title,
        durationMinutes: assessment.durationMinutes,
        requireCamera: assessment.requireCamera,
        maxWarnings: assessment.maxWarnings,
        faceAbsentSeconds: assessment.faceAbsentSeconds,
        forbidTabSwitch: assessment.forbidTabSwitch,
      },
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNo: student.admissionNo,
      },
    };
  }

  async getAttemptPayload(attemptId: string) {
    const attempt = await this.requireAttempt(attemptId);
    const assessment = await this.prisma.onlineAssessment.findFirstOrThrow({
      where: { id: attempt.assessmentId },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });

    let questions = assessment.questions.map((q) => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      marks: q.marks,
      sortOrder: q.sortOrder,
      options: stripCorrectFlags((q.options as McqOption[]) ?? []),
    }));

    if (assessment.shuffleQuestions) {
      questions = [...questions].sort(() => Math.random() - 0.5);
    }

    const answers = await this.prisma.onlineAnswer.findMany({
      where: { attemptId },
    });

    return {
      attempt: this.sanitizeAttempt(attempt),
      assessment: {
        id: assessment.id,
        title: assessment.title,
        durationMinutes: assessment.durationMinutes,
        requireCamera: assessment.requireCamera,
        maxWarnings: assessment.maxWarnings,
        faceAbsentSeconds: assessment.faceAbsentSeconds,
        forbidTabSwitch: assessment.forbidTabSwitch,
      },
      questions,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionIds: a.selectedOptionIds as string[],
      })),
      serverNow: new Date().toISOString(),
    };
  }

  async saveAnswers(
    attemptId: string,
    answers: Array<{ questionId: string; selectedOptionIds: string[] }>,
  ) {
    const attempt = await this.requireAttempt(attemptId);
    this.assertWritable(attempt);

    for (const row of answers) {
      await this.prisma.onlineAnswer.upsert({
        where: {
          attemptId_questionId: { attemptId, questionId: row.questionId },
        },
        create: {
          attemptId,
          questionId: row.questionId,
          selectedOptionIds: row.selectedOptionIds,
        },
        update: {
          selectedOptionIds: row.selectedOptionIds,
        },
      });
    }

    return { ok: true };
  }

  async heartbeat(attemptId: string) {
    const attempt = await this.requireAttempt(attemptId);
    const now = new Date();
    if (attempt.status === 'IN_PROGRESS' && attempt.expiresAt < now) {
      const locked = await this.lockAttempt(
        attempt.id,
        'TIME_EXPIRED',
        'Exam locked: time expired.',
      );
      return { attempt: this.sanitizeAttempt(locked), serverNow: now.toISOString() };
    }
    return { attempt: this.sanitizeAttempt(attempt), serverNow: now.toISOString() };
  }

  async recordProctorEvent(
    attemptId: string,
    input: { type: string; message?: string; meta?: Record<string, unknown> },
  ) {
    const attempt = await this.requireAttempt(attemptId);
    if (attempt.status !== 'IN_PROGRESS') {
      return {
        attempt: this.sanitizeAttempt(attempt),
        warningCount: attempt.warningCount,
        maxWarnings: undefined as number | undefined,
        locked: attempt.status === 'LOCKED',
      };
    }

    const assessment = await this.prisma.onlineAssessment.findFirstOrThrow({
      where: { id: attempt.assessmentId },
    });

    if (input.type === 'HEARTBEAT' || input.type === 'CAMERA_FACE_MISSING') {
      await this.prisma.proctorEvent.create({
        data: {
          attemptId,
          type: input.type,
          severity: 'INFO',
          message: input.message,
          meta: (input.meta ?? {}) as Prisma.InputJsonValue,
        },
      });
      return {
        attempt: this.sanitizeAttempt(attempt),
        warningCount: attempt.warningCount,
        maxWarnings: assessment.maxWarnings,
        locked: false,
      };
    }

    // Tab leave is not a warning — client forces focus back; we only audit + count switches.
    if (isProctorTabBlockType(input.type)) {
      if (!assessment.forbidTabSwitch) {
        return {
          attempt: this.sanitizeAttempt(attempt),
          warningCount: attempt.warningCount,
          maxWarnings: assessment.maxWarnings,
          locked: false,
          tabBlocked: false,
        };
      }
      const updated = await this.prisma.onlineAttempt.update({
        where: { id: attemptId },
        data: { tabSwitchCount: { increment: 1 } },
      });
      await this.prisma.proctorEvent.create({
        data: {
          attemptId,
          type: input.type,
          severity: 'INFO',
          message:
            input.message?.trim() ||
            'Tab switching is not allowed — return to the exam tab',
          meta: (input.meta ?? {}) as Prisma.InputJsonValue,
        },
      });
      return {
        attempt: this.sanitizeAttempt(updated),
        warningCount: updated.warningCount,
        maxWarnings: assessment.maxWarnings,
        locked: false,
        tabBlocked: true,
      };
    }

    if (isProctorHardLockType(input.type)) {
      const { code, message } = hardLockMessage(input.type);
      await this.prisma.proctorEvent.create({
        data: {
          attemptId,
          type: input.type,
          severity: 'LOCK',
          message,
          meta: (input.meta ?? {}) as Prisma.InputJsonValue,
        },
      });
      const locked = await this.lockAttempt(attemptId, code, message);
      return {
        attempt: this.sanitizeAttempt(locked),
        warningCount: locked.warningCount,
        maxWarnings: assessment.maxWarnings,
        locked: true,
      };
    }

    if (!isProctorWarningType(input.type)) {
      throw new BadRequestException(`Unsupported proctor event: ${input.type}`);
    }

    const cause = input.message?.trim() || warningCauseLabel(input.type);
    const nextCount = attempt.warningCount + 1;

    await this.prisma.proctorEvent.create({
      data: {
        attemptId,
        type: input.type,
        severity: 'WARNING',
        message: cause,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.prisma.proctorEvent.create({
      data: {
        attemptId,
        type: 'WARNING_ISSUED',
        severity: 'WARNING',
        message: `Warning ${nextCount} of ${assessment.maxWarnings}: ${cause}`,
        meta: { causeType: input.type, warningCount: nextCount },
      },
    });

    if (nextCount >= assessment.maxWarnings) {
      const warningEvents = await this.prisma.proctorEvent.findMany({
        where: { attemptId, severity: 'WARNING', type: { not: 'WARNING_ISSUED' } },
        orderBy: { at: 'asc' },
      });
      const causes = warningEvents.map((e) => e.message || warningCauseLabel(e.type));
      const lockMessage = composeWarningsExceededMessage(causes);
      const locked = await this.prisma.onlineAttempt.update({
        where: { id: attemptId },
        data: {
          warningCount: nextCount,
          status: 'LOCKED',
          lockedAt: new Date(),
          lockReasonCode: 'WARNINGS_EXCEEDED',
          lockReasonMessage: lockMessage,
        },
      });
      await this.prisma.proctorEvent.create({
        data: {
          attemptId,
          type: 'ATTEMPT_LOCKED',
          severity: 'LOCK',
          message: lockMessage,
        },
      });
      return {
        attempt: this.sanitizeAttempt(locked),
        warningCount: nextCount,
        maxWarnings: assessment.maxWarnings,
        locked: true,
      };
    }

    const updated = await this.prisma.onlineAttempt.update({
      where: { id: attemptId },
      data: {
        warningCount: nextCount,
      },
    });

    return {
      attempt: this.sanitizeAttempt(updated),
      warningCount: nextCount,
      maxWarnings: assessment.maxWarnings,
      locked: false,
    };
  }

  async submit(attemptId: string) {
    const attempt = await this.requireAttempt(attemptId);
    if (attempt.status === 'LOCKED') {
      throw new ForbiddenException(
        attempt.lockReasonMessage ?? 'Exam is locked and cannot be submitted',
      );
    }
    if (attempt.status === 'SUBMITTED') {
      return this.sanitizeAttempt(attempt);
    }
    this.assertWritable(attempt);

    const questions = await this.prisma.onlineQuestion.findMany({
      where: { assessmentId: attempt.assessmentId },
    });
    const answers = await this.prisma.onlineAnswer.findMany({ where: { attemptId } });
    const byQ = new Map(answers.map((a) => [a.questionId, a]));

    let score = 0;
    let maxScore = 0;

    for (const q of questions) {
      maxScore += q.marks;
      const ans = byQ.get(q.id);
      const selected = (ans?.selectedOptionIds as string[] | undefined) ?? [];
      const graded = gradeMcqAnswerScaled((q.options as McqOption[]) ?? [], selected, q.marks);
      score += graded.marksAwarded;
      if (ans) {
        await this.prisma.onlineAnswer.update({
          where: { id: ans.id },
          data: { isCorrect: graded.isCorrect, marksAwarded: graded.marksAwarded },
        });
      }
    }

    const submitted = await this.prisma.onlineAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score,
        maxScore,
      },
    });

    return this.sanitizeAttempt(submitted);
  }

  async unlock(
    organizationId: string,
    userId: string,
    attemptId: string,
    resetWarnings?: boolean,
  ) {
    const attempt = await this.prisma.onlineAttempt.findFirst({
      where: { id: attemptId, organizationId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'LOCKED') {
      throw new BadRequestException('Attempt is not locked');
    }

    const updated = await this.prisma.onlineAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'IN_PROGRESS',
        lockedAt: null,
        lockReasonCode: null,
        lockReasonMessage: null,
        ...(resetWarnings ? { warningCount: 0 } : {}),
      },
    });

    await this.prisma.proctorEvent.create({
      data: {
        attemptId,
        type: 'ATTEMPT_UNLOCKED',
        severity: 'INFO',
        message: resetWarnings ? 'Unlocked and warnings reset by staff' : 'Unlocked by staff',
        meta: { userId },
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UNLOCK',
      entityType: 'OnlineAttempt',
      entityId: attemptId,
    });

    return this.sanitizeAttempt(updated);
  }

  private async requireAttempt(attemptId: string) {
    const attempt = await this.prisma.onlineAttempt.findFirst({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return attempt;
  }

  private assertWritable(attempt: {
    status: string;
    expiresAt: Date;
    lockReasonMessage: string | null;
  }) {
    if (attempt.status === 'LOCKED') {
      throw new ForbiddenException(attempt.lockReasonMessage ?? 'Exam is locked');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ForbiddenException('Attempt is not writable');
    }
    if (attempt.expiresAt < new Date()) {
      throw new ForbiddenException('Exam time has expired');
    }
  }

  private async lockAttempt(attemptId: string, code: string, message: string) {
    return this.prisma.onlineAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockReasonCode: code,
        lockReasonMessage: message,
      },
    });
  }

  private sanitizeAttempt(attempt: {
    id: string;
    status: string;
    startedAt: Date;
    expiresAt: Date;
    submittedAt: Date | null;
    score: number | null;
    maxScore: number | null;
    warningCount: number;
    tabSwitchCount: number;
    lockedAt: Date | null;
    lockReasonCode: string | null;
    lockReasonMessage: string | null;
  }) {
    return {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      maxScore: attempt.maxScore,
      warningCount: attempt.warningCount,
      tabSwitchCount: attempt.tabSwitchCount,
      lockedAt: attempt.lockedAt,
      lockReasonCode: attempt.lockReasonCode,
      lockReasonMessage: attempt.lockReasonMessage,
    };
  }
}
