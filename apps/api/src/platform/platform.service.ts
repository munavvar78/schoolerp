import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { assertEnabledModules } from '@school-erp/shared';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listOrganizations() {
    return this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        enabledModules: true,
        createdAt: true,
        _count: { select: { campuses: true, students: true, users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async setModules(actorUserId: string, organizationId: string, requested: string[]) {
    const decision = assertEnabledModules(requested);
    if (!decision.ok) throw new BadRequestException(decision.message);
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Organization not found');
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { enabledModules: decision.modules },
      select: { id: true, name: true, slug: true, enabledModules: true },
    });
    await this.audit.log({
      organizationId,
      userId: actorUserId,
      action: 'SET_ORG_MODULES',
      entityType: 'Organization',
      entityId: organizationId,
      meta: { enabledModules: decision.modules },
    });
    return organization;
  }
}
