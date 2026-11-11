import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { canInviteRole, type InviteUserInput, type LoginInput, type RegisterOrganizationInput } from '@school-erp/shared';
import { Role } from '@school-erp/database';
import { appConfig } from '../config.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/types.js';

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async registerOrganization(input: RegisterOrganizationInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const baseSlug = slugify(input.organizationName) || 'school';
    let slug = baseSlug;
    let i = 1;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const passwordHash = await argon2.hash(input.password);
    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: input.organizationName, slug },
      });
      const campus = await tx.campus.create({
        data: {
          organizationId: org.id,
          name: input.campusName,
          code: 'MAIN',
          board: input.board,
        },
      });
      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: input.email.toLowerCase(),
          name: input.ownerName,
          passwordHash,
        },
      });
      await tx.membership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          campusId: campus.id,
          role: Role.ORG_OWNER,
        },
      });
      await this.seedCampusDefaults(tx, org.id, campus.id);
      return { org, campus, user };
    });

    await this.audit.log({
      organizationId: result.org.id,
      userId: result.user.id,
      action: 'REGISTER_ORG',
      entityType: 'Organization',
      entityId: result.org.id,
    });

    return this.issueSession(result.user.id, result.campus.id);
  }

  private async seedCampusDefaults(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    organizationId: string,
    campusId: string,
  ) {
    await tx.attendanceStatus.createMany({
      data: [
        { organizationId, campusId, code: 'PRESENT', label: 'Present', countsAsPresent: true, weight: 1, color: '#16a34a' },
        { organizationId, campusId, code: 'ABSENT', label: 'Absent', countsAsPresent: false, weight: 1, color: '#dc2626' },
        { organizationId, campusId, code: 'LATE', label: 'Late', countsAsPresent: true, weight: 1, color: '#ea580c' },
        { organizationId, campusId, code: 'HALF_DAY', label: 'Half Day', countsAsPresent: true, weight: 0.5, color: '#ca8a04' },
        { organizationId, campusId, code: 'EXCUSED', label: 'Excused', countsAsPresent: false, weight: 1, color: '#64748b' },
      ],
    });
    await tx.gradeScale.create({
      data: {
        organizationId,
        campusId,
        name: 'Default',
        passPercent: 33,
        bands: [
          { minPercent: 91, maxPercent: 100, grade: 'A1', isPass: true },
          { minPercent: 81, maxPercent: 90, grade: 'A2', isPass: true },
          { minPercent: 71, maxPercent: 80, grade: 'B1', isPass: true },
          { minPercent: 61, maxPercent: 70, grade: 'B2', isPass: true },
          { minPercent: 51, maxPercent: 60, grade: 'C1', isPass: true },
          { minPercent: 41, maxPercent: 50, grade: 'C2', isPass: true },
          { minPercent: 33, maxPercent: 40, grade: 'D', isPass: true },
          { minPercent: 0, maxPercent: 32.99, grade: 'E', isPass: false },
        ],
      },
    });
    await tx.ruleConfig.createMany({
      data: [
        { organizationId, campusId, key: 'late_fee', value: { fixedPaise: 5000, percent: 2, graceDays: 7 } },
        { organizationId, campusId, key: 'attendance_shortage', value: { thresholdPercent: 75 } },
        { organizationId, campusId, key: 'admission_fee', value: { amountPaise: 250000 } },
        { organizationId, campusId, key: 'admission_number_prefix', value: { prefix: 'ADM-' } },
        {
          organizationId,
          campusId,
          key: 'notice_categories',
          value: { categories: ['Academic', 'Fee', 'Holiday', 'Urgent'] },
        },
        {
          organizationId,
          campusId,
          key: 'timetable_week',
          value: { workingDays: [1, 2, 3, 4, 5, 6], saturdays: 'on' },
        },
        { organizationId, campusId, key: 'homework_late_grace_days', value: { days: 1 } },
      ],
    });
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { memberships: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const membership =
      user.memberships.find((m) => m.campusId === input.campusId) ?? user.memberships[0];
    if (!membership) throw new UnauthorizedException('No campus membership');
    return this.issueSession(user.id, membership.campusId);
  }

  async invite(
    input: InviteUserInput,
    actor: AuthUser,
    organizationId: string,
    actorRole: Role,
    actorCampusId: string,
  ) {
    if (!canInviteRole(actorRole, input.role, actorCampusId, input.campusId)) {
      throw new ForbiddenException('You cannot invite that role');
    }
    const campus = await this.prisma.campus.findFirst({
      where: { id: input.campusId, organizationId },
    });
    if (!campus) throw new ConflictException('Campus not found in organization');

    let user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (user && user.organizationId !== organizationId) {
      throw new ConflictException('That email cannot be invited');
    }
    if (!user) {
      const passwordHash = await argon2.hash(input.password ?? randomBytes(9).toString('base64url'));
      user = await this.prisma.user.create({
        data: {
          organizationId,
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash,
        },
      });
    }

    await this.prisma.membership.upsert({
      where: {
        userId_campusId_role: {
          userId: user.id,
          campusId: input.campusId,
          role: input.role as Role,
        },
      },
      create: {
        organizationId,
        userId: user.id,
        campusId: input.campusId,
        role: input.role as Role,
      },
      update: {},
    });

    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: 'INVITE_USER',
      entityType: 'User',
      entityId: user.id,
      meta: { role: input.role, campusId: input.campusId },
    });

    return { id: user.id, email: user.email, name: user.name };
  }

  async me(userId: string) {
    return this.loadAuthUser(userId);
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    let payload: { sub: string; campusId: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: appConfig.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueSession(payload.sub, payload.campusId);
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  private async issueSession(userId: string, campusId: string) {
    const user = await this.loadAuthUser(userId);
    const membership = user.memberships.find((m) => m.campusId === campusId) ?? user.memberships[0];
    if (!membership) throw new UnauthorizedException('No membership');

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        org: membership.organizationId,
        campusId: membership.campusId,
        role: membership.role,
      },
      { secret: appConfig.jwtAccessSecret, expiresIn: appConfig.accessTtlSec },
    );

    const refreshToken = await this.jwt.signAsync(
      {
        sub: user.id,
        campusId: membership.campusId,
        jti: randomBytes(16).toString('hex'),
      },
      { secret: appConfig.jwtRefreshSecret, expiresIn: appConfig.refreshTtlSec },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + appConfig.refreshTtlSec * 1000),
      },
    });

    const enabledModules = await this.getEnabledModules(membership.organizationId);

    return {
      accessToken,
      refreshToken,
      user,
      campusId: membership.campusId,
      organizationId: membership.organizationId,
      role: membership.role,
      enabledModules,
    };
  }

  async getEnabledModules(organizationId: string): Promise<import('@school-erp/shared').ModuleKey[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { enabledModules: true },
    });
    return (org?.enabledModules ?? []) as import('@school-erp/shared').ModuleKey[];
  }

  async loadAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: true },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        campusId: m.campusId,
        role: m.role as AuthUser['memberships'][number]['role'],
        organizationId: m.organizationId,
      })),
    };
  }
}
