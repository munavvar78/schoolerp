import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  convertAdmissionSchema,
  createAdmissionSchema,
  recordAdmissionFeeSchema,
  transitionAdmissionSchema,
} from '@school-erp/shared';
import { Ctx, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { AdmissionsService } from './admissions.service.js';

@RequireModule('admissions')
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT', 'PLATFORM_OPERATOR')
  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.admissions.list(ctx.organizationId, ctx.campusId, { status, sessionId });
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(createAdmissionSchema)) body: unknown,
  ) {
    return this.admissions.create(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('transition')
  transition(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(transitionAdmissionSchema)) body: unknown,
  ) {
    return this.admissions.transition(ctx.organizationId, ctx.user.id, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT')
  @Post('fee')
  recordFee(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(recordAdmissionFeeSchema)) body: unknown,
  ) {
    return this.admissions.recordFee(ctx.organizationId, ctx.user.id, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN')
  @Post('convert')
  convert(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(convertAdmissionSchema)) body: unknown,
  ) {
    return this.admissions.convert(
      ctx.organizationId,
      ctx.campusId,
      ctx.user.id,
      body as never,
    );
  }
}
