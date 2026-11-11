import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { issueCertificateSchema } from '@school-erp/shared';
import { Ctx, Public, RequireModule, Roles } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { CertificatesService } from './certificates.service.js';

@RequireModule('certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.certificates.list(ctx.organizationId, ctx.campusId, ctx.role, ctx.user.id);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT', 'PLATFORM_OPERATOR')
  @Post()
  issue(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(issueCertificateSchema)) body: unknown,
  ) {
    return this.certificates.issue(ctx.organizationId, ctx.campusId, ctx.user.id, ctx.role, body as never);
  }

  @Roles('ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR')
  @Post(':id/revoke')
  revoke(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.certificates.revoke(ctx.organizationId, ctx.campusId, ctx.user.id, id);
  }

  @Public()
  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.certificates.verify(code);
  }
}
