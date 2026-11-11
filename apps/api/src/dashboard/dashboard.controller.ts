import { Body, Controller, Get, Post } from '@nestjs/common';
import { aiQuerySchema } from '@school-erp/shared';
import { Ctx, RequireModule } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { DashboardService } from './dashboard.service.js';

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequireModule('dashboard')
  @Get('dashboard/overview')
  overview(@Ctx() ctx: RequestContext) {
    return this.dashboard.overview(ctx.organizationId, ctx.campusId, {
      role: ctx.role,
      userId: ctx.user.id,
    });
  }

  @RequireModule('ai')
  @Post('ai/ask')
  ask(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(aiQuerySchema)) body: unknown,
  ) {
    const parsed = body as { question: string };
    return this.dashboard.askAi(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      parsed.question,
      { role: ctx.role, enabledModules: ctx.enabledModules },
    );
  }
}
