import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { createHomeworkSchema, markHomeworkCompletionSchema } from '@school-erp/shared';
import { Ctx, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { HomeworkService } from './homework.service.js';

@RequireModule('homework')
@Controller('homework')
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('sectionId') sectionId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    if (ctx.role === 'PARENT' || ctx.role === 'STUDENT') {
      return this.homework.forParent(ctx.organizationId, ctx.user.id);
    }
    return this.homework.list(ctx.organizationId, ctx.campusId, {
      sectionId,
      sessionId,
    });
  }

  @Get('mine')
  mine(@Ctx() ctx: RequestContext) {
    return this.homework.forParent(ctx.organizationId, ctx.user.id);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(createHomeworkSchema)) body: unknown,
  ) {
    return this.homework.create(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('completion')
  markCompletion(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(markHomeworkCompletionSchema)) body: unknown,
  ) {
    return this.homework.markCompletion(ctx.organizationId, ctx.user.id, body as never);
  }
}
