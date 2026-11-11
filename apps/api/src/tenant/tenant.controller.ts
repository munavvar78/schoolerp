import { Controller, Get } from '@nestjs/common';
import { Ctx, Public } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Health + tenant-scoped probe used by isolation tests. */
@Controller()
export class TenantIsolationController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  health() {
    return { ok: true, service: 'school-erp-api' };
  }

  @Get('tenant/students-count')
  async studentsCount(@Ctx() ctx: RequestContext) {
    const count = await this.prisma.student.count({
      where: { organizationId: ctx.organizationId, campusId: ctx.campusId },
    });
    return { organizationId: ctx.organizationId, campusId: ctx.campusId, count };
  }
}
