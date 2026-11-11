import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ModuleKey, Role } from '@school-erp/shared';
import { isModuleEnabled } from '@school-erp/shared';
import { appConfig } from '../config.js';
import { IS_PUBLIC_KEY, MODULE_KEY, ROLES_KEY } from '../common/decorators.js';
import type { RequestContext } from '../common/types.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      ctx?: RequestContext;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }
    const token = header.slice(7);
    let payload: { sub: string; org: string; campusId: string; role: Role };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: appConfig.jwtAccessSecret });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.auth.loadAuthUser(payload.sub);
    const membership = user.memberships.find(
      (m) => m.campusId === payload.campusId && m.organizationId === payload.org,
    );
    if (!membership) throw new ForbiddenException('Membership mismatch');

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    const enabledModules = await this.auth.getEnabledModules(membership.organizationId);

    const requiredModule = this.reflector.getAllAndOverride<ModuleKey>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      requiredModule &&
      !isModuleEnabled(membership.role, requiredModule, enabledModules)
    ) {
      throw new ForbiddenException(`Module disabled: ${requiredModule}`);
    }

    request.ctx = {
      user,
      organizationId: membership.organizationId,
      campusId: membership.campusId,
      role: membership.role,
      enabledModules,
    };
    return true;
  }
}
