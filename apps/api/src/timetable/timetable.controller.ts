import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { periodSlotSchema, upsertTimetableGridSchema } from '@school-erp/shared';
import { Ctx, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { TimetableService } from './timetable.service.js';

@RequireModule('timetable')
@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}

  @Get('slots')
  slots(@Ctx() ctx: RequestContext) {
    return this.timetable.listSlots(ctx.organizationId, ctx.campusId);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('slots')
  createSlot(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(periodSlotSchema)) body: unknown,
  ) {
    return this.timetable.createSlot(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER', 'PLATFORM_OPERATOR')
  @Get('teachers')
  teachers(@Ctx() ctx: RequestContext) {
    return this.timetable.listTeachers(ctx.organizationId, ctx.campusId);
  }

  @Get('section')
  bySection(
    @Ctx() ctx: RequestContext,
    @Query('sectionId') sectionId: string,
    @Query('sessionId') sessionId: string,
  ) {
    return this.timetable.listBySection(
      ctx.organizationId,
      ctx.campusId,
      sectionId,
      sessionId,
      { role: ctx.role, userId: ctx.user.id },
    );
  }

  @Get('mine')
  mine(@Ctx() ctx: RequestContext, @Query('sessionId') sessionId?: string) {
    return this.timetable.listMine(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      sessionId,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('grid')
  upsertGrid(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(upsertTimetableGridSchema)) body: unknown,
  ) {
    return this.timetable.upsertGrid(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }
}
