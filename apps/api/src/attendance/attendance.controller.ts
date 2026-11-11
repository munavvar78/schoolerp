import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { markAttendanceSchema } from '@school-erp/shared';
import { Ctx, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { AttendanceService } from './attendance.service.js';

@RequireModule('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('grid')
  grid(
    @Ctx() ctx: RequestContext,
    @Query('sectionId') sectionId: string,
    @Query('sessionId') sessionId: string,
    @Query('date') date: string,
  ) {
    return this.attendance.getGrid(ctx.organizationId, ctx.campusId, sectionId, sessionId, date, {
      role: ctx.role,
      userId: ctx.user.id,
    });
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER', 'TEACHER')
  @Post('mark')
  mark(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(markAttendanceSchema)) body: unknown,
  ) {
    return this.attendance.mark(ctx.organizationId, ctx.campusId, ctx.user.id, body as never);
  }

  @Get('rate')
  rate(@Ctx() ctx: RequestContext, @Query('enrollmentId') enrollmentId: string) {
    return this.attendance.rateForEnrollment(ctx.organizationId, enrollmentId, {
      role: ctx.role,
      userId: ctx.user.id,
    });
  }

  @Get('summary')
  summary(@Ctx() ctx: RequestContext) {
    return this.attendance.summaryForActor(ctx.organizationId, ctx.campusId, ctx.role, ctx.user.id);
  }
}
