import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  academicSessionSchema,
  attendanceStatusSchema,
  fieldDefinitionSchema,
  gradeScaleSchema,
  gradeSchema,
  sectionSchema,
  subjectSchema,
} from '@school-erp/shared';
import { Ctx, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { AcademicService } from './academic.service.js';

@Controller('academic')
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  @Get('campus')
  campus(@Ctx() ctx: RequestContext) {
    return this.academic.getCampus(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR', 'TEACHER', 'CLASS_TEACHER', 'ACCOUNTANT')
  @Get('sessions')
  sessions(@Ctx() ctx: RequestContext) {
    return this.academic.listSessions(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('sessions')
  createSession(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(academicSessionSchema)) body: unknown,
  ) {
    return this.academic.createSession(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR', 'TEACHER', 'CLASS_TEACHER', 'ACCOUNTANT')
  @Get('grades')
  grades(@Ctx() ctx: RequestContext) {
    return this.academic.listGrades(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('grades')
  createGrade(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(gradeSchema)) body: unknown,
  ) {
    return this.academic.createGrade(ctx.organizationId, ctx.campusId, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('sections')
  createSection(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(sectionSchema)) body: unknown,
  ) {
    return this.academic.createSection(ctx.organizationId, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR', 'TEACHER', 'CLASS_TEACHER')
  @Get('subjects')
  subjects(@Ctx() ctx: RequestContext) {
    return this.academic.listSubjects(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('subjects')
  createSubject(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(subjectSchema)) body: unknown,
  ) {
    return this.academic.createSubject(ctx.organizationId, ctx.campusId, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR')
  @Get('attendance-statuses')
  attendanceStatuses(@Ctx() ctx: RequestContext) {
    return this.academic.listAttendanceStatuses(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('attendance-statuses')
  createAttendanceStatus(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(attendanceStatusSchema)) body: unknown,
  ) {
    return this.academic.createAttendanceStatus(
      ctx.organizationId,
      ctx.campusId,
      body as never,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR')
  @Get('grade-scales')
  gradeScales(@Ctx() ctx: RequestContext) {
    return this.academic.listGradeScales(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('grade-scales')
  createGradeScale(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(gradeScaleSchema)) body: unknown,
  ) {
    return this.academic.createGradeScale(ctx.organizationId, ctx.campusId, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR')
  @Get('field-definitions')
  fieldDefinitions(@Ctx() ctx: RequestContext, @Query('entityType') entityType?: string) {
    return this.academic.listFieldDefinitions(ctx.organizationId, ctx.campusId, entityType);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('field-definitions')
  createFieldDefinition(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(fieldDefinitionSchema)) body: unknown,
  ) {
    return this.academic.createFieldDefinition(
      ctx.organizationId,
      ctx.campusId,
      body as never,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR')
  @Get('rules')
  rules(@Ctx() ctx: RequestContext) {
    return this.academic.listRuleConfigs(ctx.organizationId, ctx.campusId);
  }
}
