import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { examSchema, saveScoresSchema } from '@school-erp/shared';
import { Ctx, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { ExamsService } from './exams.service.js';

@RequireModule('exams')
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.exams.listForActor(ctx.organizationId, ctx.campusId, ctx.role, ctx.user.id);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(examSchema)) body: unknown,
  ) {
    return this.exams.create(ctx.organizationId, ctx.campusId, ctx.user.id, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('scores')
  scores(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(saveScoresSchema)) body: unknown,
  ) {
    return this.exams.saveScores(ctx.organizationId, ctx.user.id, body as never);
  }

  @Get('analytics/subject-averages')
  averages(@Ctx() ctx: RequestContext) {
    return this.exams.averagesForActor(ctx.organizationId, ctx.campusId, ctx.role, ctx.user.id);
  }

  @Get(':id/results')
  results(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.exams.resultsForActor(ctx.organizationId, id, ctx.role, ctx.user.id);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER')
  @Post(':id/publish')
  publish(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.exams.publish(ctx.organizationId, ctx.user.id, id);
  }
}
