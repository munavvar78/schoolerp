import { Body, Controller, ForbiddenException, Get, Post, Query } from '@nestjs/common';
import {
  bulkEnrollmentSchema,
  bulkStudentsSchema,
  enrollmentSchema,
  guardianSchema,
  isModuleEnabled,
  studentSchema,
} from '@school-erp/shared';
import { z } from 'zod';
import { Ctx, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { StudentsService } from './students.service.js';

const addGuardianBody = guardianSchema.extend({
  studentId: z.string().cuid(),
  linkUserId: z.string().cuid().optional(),
  isPrimary: z.boolean().optional(),
});

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('q') q?: string,
    @Query('sectionId') sectionId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    if (ctx.role === 'PARENT' || ctx.role === 'STUDENT') {
      return this.students.getForParent(ctx.organizationId, ctx.user.id);
    }
    if (!isModuleEnabled(ctx.role, 'students', ctx.enabledModules)) {
      throw new ForbiddenException('Module disabled: students');
    }
    return this.students.list(ctx.organizationId, ctx.campusId, { q, sectionId, sessionId }, ctx.role);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER', 'TEACHER')
  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(studentSchema)) body: unknown,
  ) {
    return this.students.create(ctx.organizationId, ctx.campusId, ctx.user.id, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('bulk')
  createBulk(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(bulkStudentsSchema)) body: unknown,
  ) {
    return this.students.createBulk(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER')
  @Post('enroll')
  enroll(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(enrollmentSchema)) body: unknown,
  ) {
    return this.students.enroll(ctx.organizationId, ctx.user.id, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER')
  @Post('bulk-enroll')
  bulkEnroll(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(bulkEnrollmentSchema)) body: unknown,
  ) {
    return this.students.bulkEnroll(ctx.organizationId, ctx.campusId, ctx.user.id, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('guardians')
  addGuardian(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(addGuardianBody)) body: unknown,
  ) {
    return this.students.addGuardian(ctx.organizationId, body as never);
  }

  @Get('my-children')
  myChildren(@Ctx() ctx: RequestContext) {
    return this.students.getForParent(ctx.organizationId, ctx.user.id);
  }
}
