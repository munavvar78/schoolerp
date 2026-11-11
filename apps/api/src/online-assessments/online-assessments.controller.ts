import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  addOnlineQuestionSchema,
  createOnlineAssessmentSchema,
  deleteOnlineAssessmentSchema,
  deleteOnlineQuestionSchema,
  enrollSectionSchema,
  joinOnlineAssessmentSchema,
  proctorEventSchema,
  saveOnlineAnswersSchema,
  unlockAttemptSchema,
  updateOnlineAssessmentSettingsSchema,
  updateOnlineAssessmentStatusSchema,
  updateOnlineQuestionSchema,
} from '@school-erp/shared';
import { Ctx, Public, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import {
  OnlineAttemptGuard,
  type AttemptTokenPayload,
} from './attempt.guard.js';
import { OnlineAssessmentsService } from './online-assessments.service.js';

@Controller('online-assessments')
export class OnlineAssessmentsController {
  constructor(private readonly service: OnlineAssessmentsService) {}

  @Public()
  @Post('join')
  join(@Body(new ZodValidationPipe(joinOnlineAssessmentSchema)) body: unknown) {
    return this.service.join(body as never);
  }

  @Public()
  @UseGuards(OnlineAttemptGuard)
  @Get('attempt/me')
  attemptMe(@Req() req: { attempt: AttemptTokenPayload }) {
    return this.service.getAttemptPayload(req.attempt.attemptId);
  }

  @Public()
  @UseGuards(OnlineAttemptGuard)
  @Put('attempt/answers')
  saveAnswers(
    @Req() req: { attempt: AttemptTokenPayload },
    @Body(new ZodValidationPipe(saveOnlineAnswersSchema)) body: unknown,
  ) {
    const parsed = body as {
      answers: Array<{ questionId: string; selectedOptionIds: string[] }>;
    };
    return this.service.saveAnswers(req.attempt.attemptId, parsed.answers);
  }

  @Public()
  @UseGuards(OnlineAttemptGuard)
  @Post('attempt/heartbeat')
  heartbeat(@Req() req: { attempt: AttemptTokenPayload }) {
    return this.service.heartbeat(req.attempt.attemptId);
  }

  @Public()
  @UseGuards(OnlineAttemptGuard)
  @Post('attempt/proctor-events')
  proctor(
    @Req() req: { attempt: AttemptTokenPayload },
    @Body(new ZodValidationPipe(proctorEventSchema)) body: unknown,
  ) {
    return this.service.recordProctorEvent(req.attempt.attemptId, body as never);
  }

  @Public()
  @UseGuards(OnlineAttemptGuard)
  @Post('attempt/submit')
  submit(@Req() req: { attempt: AttemptTokenPayload }) {
    return this.service.submit(req.attempt.attemptId);
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.service.list(ctx.organizationId, ctx.campusId);
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(createOnlineAssessmentSchema)) body: unknown,
  ) {
    return this.service.create(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('questions')
  addQuestion(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(addOnlineQuestionSchema)) body: unknown,
  ) {
    const parsed = body as {
      assessmentId: string;
      question: never;
    };
    return this.service.addQuestion(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      parsed.assessmentId,
      parsed.question,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Put('questions')
  updateQuestion(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(updateOnlineQuestionSchema)) body: unknown,
  ) {
    const parsed = body as {
      assessmentId: string;
      questionId: string;
      question: never;
    };
    return this.service.updateQuestion(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      parsed.assessmentId,
      parsed.questionId,
      parsed.question,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('questions/delete')
  deleteQuestion(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(deleteOnlineQuestionSchema)) body: unknown,
  ) {
    const parsed = body as { assessmentId: string; questionId: string };
    return this.service.deleteQuestion(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      parsed.assessmentId,
      parsed.questionId,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('status')
  setStatus(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(updateOnlineAssessmentStatusSchema)) body: unknown,
  ) {
    const parsed = body as { assessmentId: string; status: never };
    return this.service.setStatus(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      parsed.assessmentId,
      parsed.status,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('settings')
  updateSettings(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(updateOnlineAssessmentSettingsSchema)) body: unknown,
  ) {
    const parsed = body as {
      assessmentId: string;
      title?: string;
      durationMinutes?: number;
      requireCamera?: boolean;
      maxWarnings?: number;
      faceAbsentSeconds?: number;
    };
    return this.service.updateSettings(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      parsed.assessmentId,
      parsed,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('delete')
  deleteAssessment(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(deleteOnlineAssessmentSchema)) body: unknown,
  ) {
    const parsed = body as { assessmentId: string };
    return this.service.deleteAssessment(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      parsed.assessmentId,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('enroll-section')
  enrollSection(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(enrollSectionSchema)) body: unknown,
  ) {
    const parsed = body as { assessmentId: string; sectionId: string };
    return this.service.enrollSection(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      parsed.assessmentId,
      parsed.sectionId,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER')
  @Post('unlock')
  unlock(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(unlockAttemptSchema)) body: unknown,
  ) {
    const parsed = body as { attemptId: string; resetWarnings?: boolean };
    return this.service.unlock(
      ctx.organizationId,
      ctx.user.id,
      parsed.attemptId,
      parsed.resetWarnings,
    );
  }

  @RequireModule('online_assessments')
  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.service.get(ctx.organizationId, ctx.campusId, id);
  }
}
