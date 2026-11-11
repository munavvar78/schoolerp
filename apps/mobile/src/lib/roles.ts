import type { ModuleKey, Role } from '@school-erp/shared';
import { isModuleEnabled } from '@school-erp/shared';
import type { MobileSession } from '../auth/session';

export const ROLE_LABEL: Record<Role, string> = {
  PLATFORM_OPERATOR: 'Platform',
  ORG_OWNER: 'Owner',
  CAMPUS_ADMIN: 'Admin',
  ACCOUNTANT: 'Accounts',
  TEACHER: 'Teacher',
  CLASS_TEACHER: 'Class teacher',
  PARENT: 'Parent',
  STUDENT: 'Student',
};

export const MARK_ROLES: Role[] = ['ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER', 'TEACHER'];
export const FEE_WRITE_ROLES: Role[] = ['ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT'];
export const NOTICE_WRITE_ROLES: Role[] = ['ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER'];
export const HOMEWORK_WRITE_ROLES: Role[] = NOTICE_WRITE_ROLES;
export const ADMISSION_WRITE_ROLES: Role[] = ['ORG_OWNER', 'CAMPUS_ADMIN'];
export const ADMISSION_FEE_ROLES: Role[] = ['ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT'];

export function isFamilyRole(role: Role): boolean {
  return role === 'PARENT' || role === 'STUDENT';
}

export function hasModule(session: MobileSession | null | undefined, module: ModuleKey): boolean {
  if (!session) return false;
  return isModuleEnabled(session.role, module, session.enabledModules);
}

export function roleCan(role: Role | undefined, allowed: readonly Role[]): boolean {
  return role ? allowed.includes(role) : false;
}

const GUARDED_ROUTES: Array<{ prefix: string; allow: (session: MobileSession) => boolean }> = [
  { prefix: '/attendance', allow: (session) => hasModule(session, 'attendance') },
  { prefix: '/online-exams', allow: (session) => hasModule(session, 'online_assessments') && !isFamilyRole(session.role) && session.role !== 'PLATFORM_OPERATOR' },
  { prefix: '/compose-homework', allow: (session) => hasModule(session, 'homework') && roleCan(session.role, HOMEWORK_WRITE_ROLES) },
  { prefix: '/compose-notice', allow: (session) => hasModule(session, 'notices') && roleCan(session.role, NOTICE_WRITE_ROLES) },
  { prefix: '/certificates', allow: (session) => hasModule(session, 'certificates') },
  { prefix: '/admissions', allow: (session) => hasModule(session, 'admissions') },
  { prefix: '/timetable', allow: (session) => hasModule(session, 'timetable') },
  { prefix: '/inventory', allow: (session) => hasModule(session, 'inventory') },
  { prefix: '/transport', allow: (session) => hasModule(session, 'transport') },
  { prefix: '/messages', allow: (session) => hasModule(session, 'messages') },
  { prefix: '/homework', allow: (session) => hasModule(session, 'homework') },
  { prefix: '/platform', allow: (session) => session.role === 'PLATFORM_OPERATOR' },
  { prefix: '/library', allow: (session) => hasModule(session, 'library') },
  { prefix: '/payroll', allow: (session) => hasModule(session, 'payroll') },
  { prefix: '/notices', allow: (session) => hasModule(session, 'notices') },
  { prefix: '/hostel', allow: (session) => hasModule(session, 'hostel') },
  { prefix: '/notice', allow: (session) => hasModule(session, 'notices') },
  { prefix: '/student', allow: (session) => hasModule(session, 'students') || hasModule(session, 'parents') },
  { prefix: '/privacy', allow: () => true },
  { prefix: '/profile', allow: () => true },
  { prefix: '/apaar', allow: (session) => session.role === 'ORG_OWNER' || session.role === 'CAMPUS_ADMIN' || session.role === 'PLATFORM_OPERATOR' },
  { prefix: '/exams', allow: (session) => hasModule(session, 'exams') },
  { prefix: '/exam', allow: (session) => hasModule(session, 'exams') },
  { prefix: '/fees', allow: (session) => hasModule(session, 'fees') },
  { prefix: '/hr', allow: (session) => hasModule(session, 'hr') },
];

export function routeBlocked(session: MobileSession, pathname: string) {
  const rule = GUARDED_ROUTES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  return rule ? !rule.allow(session) : false;
}
