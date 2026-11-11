import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateNoticeInput } from '@school-erp/shared';
import type { Role } from '@school-erp/shared';
import { Prisma } from '@school-erp/database';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    organizationId: string,
    campusId: string,
    userId: string,
    input: CreateNoticeInput,
  ) {
    const notice = await this.prisma.notice.create({
      data: {
        organizationId,
        campusId,
        title: input.title,
        body: input.body,
        category: input.category,
        priority: input.priority,
        createdByUserId: userId,
        publishedAt: input.publish ? new Date() : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        audiences: {
          create: input.audiences.map((a) => ({
            type: a.type,
            role: a.role,
            targetId: a.targetId,
          })),
        },
      },
      include: { audiences: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: input.publish ? 'PUBLISH' : 'CREATE',
      entityType: 'Notice',
      entityId: notice.id,
    });

    return notice;
  }

  async publish(organizationId: string, userId: string, noticeId: string) {
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, organizationId },
    });
    if (!notice) throw new NotFoundException('Notice not found');
    const updated = await this.prisma.notice.update({
      where: { id: noticeId },
      data: { publishedAt: new Date() },
      include: { audiences: true },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'PUBLISH',
      entityType: 'Notice',
      entityId: noticeId,
    });
    return updated;
  }

  async listAdmin(organizationId: string, campusId: string) {
    return this.prisma.notice.findMany({
      where: { organizationId, campusId },
      include: { audiences: true, receipts: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  private async visibleNoticeIds(
    organizationId: string,
    campusId: string,
    role: Role,
    userId: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, campusId, userId, role },
    });
    if (!membership) throw new ForbiddenException('No membership');

    const guardian = await this.prisma.guardian.findFirst({
      where: { organizationId, userId },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  include: { section: true },
                },
              },
            },
          },
        },
      },
    });

    const gradeIds = new Set<string>();
    const sectionIds = new Set<string>();
    for (const link of guardian?.students ?? []) {
      for (const enr of link.student.enrollments) {
        sectionIds.add(enr.sectionId);
        gradeIds.add(enr.section.gradeId);
      }
    }

    const notices = await this.prisma.notice.findMany({
      where: {
        organizationId,
        campusId,
        publishedAt: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { audiences: true, receipts: { where: { userId } } },
      orderBy: [{ publishedAt: 'desc' }],
      take: 100,
    });

    return notices.filter((n) =>
      n.audiences.some((a) => {
        if (a.type === 'CAMPUS') return true;
        if (a.type === 'ROLE') return a.role === role;
        if (a.type === 'GRADE') return a.targetId ? gradeIds.has(a.targetId) : false;
        if (a.type === 'SECTION') return a.targetId ? sectionIds.has(a.targetId) : false;
        return false;
      }),
    );
  }

  async inbox(organizationId: string, campusId: string, role: Role, userId: string) {
    return this.visibleNoticeIds(organizationId, campusId, role, userId);
  }

  async markRead(organizationId: string, campusId: string, role: Role, userId: string, noticeId: string) {
    const visible = await this.visibleNoticeIds(organizationId, campusId, role, userId);
    if (!visible.some((notice) => notice.id === noticeId)) {
      throw new ForbiddenException('Notice not available');
    }
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, organizationId },
    });
    if (!notice) throw new NotFoundException('Notice not found');
    return this.prisma.noticeReceipt.upsert({
      where: { noticeId_userId: { noticeId, userId } },
      create: { noticeId, userId },
      update: { readAt: new Date() },
    });
  }

  async unpublishedCount(organizationId: string, campusId: string) {
    return this.prisma.notice.count({
      where: { organizationId, campusId, publishedAt: null },
    });
  }

  /** Tenant contract helper — always includes organizationId. */
  scopeNotices(organizationId: string, campusId: string): Prisma.NoticeWhereInput {
    return { organizationId, campusId };
  }
}
