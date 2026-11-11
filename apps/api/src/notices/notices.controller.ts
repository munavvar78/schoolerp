import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  createNoticeSchema,
  markNoticeReadSchema,
  publishNoticeSchema,
} from '@school-erp/shared';
import { Ctx, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { NoticesService } from './notices.service.js';

@RequireModule('notices')
@Controller('notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER', 'PLATFORM_OPERATOR')
  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.notices.listAdmin(ctx.organizationId, ctx.campusId);
  }

  @Get('inbox')
  inbox(@Ctx() ctx: RequestContext) {
    return this.notices.inbox(ctx.organizationId, ctx.campusId, ctx.role, ctx.user.id);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(createNoticeSchema)) body: unknown,
  ) {
    return this.notices.create(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER')
  @Post('publish')
  publish(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(publishNoticeSchema)) body: unknown,
  ) {
    const parsed = body as { noticeId: string };
    return this.notices.publish(ctx.organizationId, ctx.user.id, parsed.noticeId);
  }

  @Post('read')
  markRead(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(markNoticeReadSchema)) body: unknown,
  ) {
    const parsed = body as { noticeId: string };
    return this.notices.markRead(ctx.organizationId, ctx.campusId, ctx.role, ctx.user.id, parsed.noticeId);
  }
}
