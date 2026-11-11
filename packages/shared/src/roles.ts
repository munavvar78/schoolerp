export const ROLES = [
  'PLATFORM_OPERATOR',
  'ORG_OWNER',
  'CAMPUS_ADMIN',
  'ACCOUNTANT',
  'TEACHER',
  'CLASS_TEACHER',
  'PARENT',
  'STUDENT',
] as const;

export type Role = (typeof ROLES)[number];

export const MODULES = [
  'dashboard',
  'setup',
  'students',
  'attendance',
  'fees',
  'exams',
  'ai',
  'parents',
  'admissions',
  'timetable',
  'homework',
  'notices',
  'online_assessments',
  'certificates',
  'library',
  'transport',
  'inventory',
  'hostel',
  'hr',
  'payroll',
  'messages',
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const DEFAULT_ENABLED_MODULES: ModuleKey[] = [...MODULES];

export const ROLE_MODULES: Record<Role, ModuleKey[]> = {
  PLATFORM_OPERATOR: [...MODULES],
  ORG_OWNER: [...MODULES],
  CAMPUS_ADMIN: [...MODULES],
  ACCOUNTANT: ['dashboard', 'fees', 'students', 'admissions', 'ai', 'certificates', 'inventory', 'payroll'],
  TEACHER: [
    'dashboard',
    'students',
    'attendance',
    'exams',
    'online_assessments',
    'timetable',
    'homework',
    'notices',
    'certificates',
    'ai',
  ],
  CLASS_TEACHER: [
    'dashboard',
    'students',
    'attendance',
    'exams',
    'online_assessments',
    'timetable',
    'homework',
    'notices',
    'certificates',
    'ai',
  ],
  PARENT: [
    'dashboard',
    'parents',
    'fees',
    'exams',
    'attendance',
    'timetable',
    'homework',
    'notices',
    'certificates',
    'transport',
  ],
  STUDENT: [
    'dashboard',
    'parents',
    'exams',
    'attendance',
    'timetable',
    'homework',
    'notices',
    'certificates',
    'transport',
  ],
};

/** Nav / API module access = role modules ∩ organization.enabledModules. */
export function modulesForRole(
  role: Role,
  enabledModules?: string[] | null,
): ModuleKey[] {
  const roleModules = ROLE_MODULES[role] ?? [];
  if (!enabledModules?.length) return roleModules;
  const enabled = new Set(enabledModules);
  return roleModules.filter((m) => enabled.has(m));
}

export function isModuleEnabled(
  role: Role,
  module: ModuleKey,
  enabledModules?: string[] | null,
): boolean {
  return modulesForRole(role, enabledModules).includes(module);
}

const TRANSPORT_WRITE_ROLES = ['ORG_OWNER', 'CAMPUS_ADMIN', 'PLATFORM_OPERATOR'] as const;

export function canWriteTransport(role: string) {
  return (TRANSPORT_WRITE_ROLES as readonly string[]).includes(role);
}

/** Owner may invite school roles on any campus. A campus admin may invite only on their own campus, and cannot grant owner or master admin. */
export function canInviteRole(
  actorRole: string,
  targetRole: string,
  actorCampusId: string,
  targetCampusId: string,
) {
  if (targetRole === 'PLATFORM_OPERATOR') return false;
  if (actorRole === 'ORG_OWNER') return targetRole !== 'PLATFORM_OPERATOR';
  if (actorRole === 'CAMPUS_ADMIN') {
    return actorCampusId === targetCampusId && targetRole !== 'ORG_OWNER' && targetRole !== 'PLATFORM_OPERATOR';
  }
  return false;
}
