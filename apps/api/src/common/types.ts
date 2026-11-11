import type { ModuleKey, Role } from '@school-erp/shared';

export interface AuthMembership {
  id: string;
  campusId: string;
  role: Role;
  organizationId: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  organizationId: string | null;
  memberships: AuthMembership[];
}

export interface RequestContext {
  user: AuthUser;
  organizationId: string;
  campusId: string;
  role: Role;
  enabledModules: ModuleKey[];
}
