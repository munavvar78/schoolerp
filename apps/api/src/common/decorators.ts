import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ModuleKey, Role } from '@school-erp/shared';
import type { RequestContext } from './types.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const MODULE_KEY = 'module';
export const RequireModule = (module: ModuleKey) => SetMetadata(MODULE_KEY, module);

export const Ctx = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestContext => {
  const request = ctx.switchToHttp().getRequest<{ ctx: RequestContext }>();
  return request.ctx;
});
