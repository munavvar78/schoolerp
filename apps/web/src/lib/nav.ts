import type { ModuleKey, Role } from '@school-erp/shared';
import { modulesForRole } from '@school-erp/shared';
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  MonitorPlay,
  Receipt,
  Settings2,
  UserPlus,
  Users,
  UsersRound,
  CalendarDays,
  ScrollText,
  Shield,
  Library,
  Bus,
  Package,
  BedDouble,
  IdCard,
  Wallet,
  MessageSquare,
  Lock,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  module: ModuleKey;
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_BY_MODULE: Partial<Record<ModuleKey, NavItem>> = {
  dashboard: { module: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  setup: { module: 'setup', href: '/setup', label: 'Setup', icon: Settings2 },
  students: { module: 'students', href: '/students', label: 'Students', icon: Users },
  attendance: { module: 'attendance', href: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  fees: { module: 'fees', href: '/fees', label: 'Fees', icon: Receipt },
  exams: { module: 'exams', href: '/exams', label: 'Exams', icon: BookOpen },
  online_assessments: {
    module: 'online_assessments',
    href: '/online-exams',
    label: 'Online Exams',
    icon: MonitorPlay,
  },
  parents: { module: 'parents', href: '/parent', label: 'Parent Portal', icon: UsersRound },
  admissions: { module: 'admissions', href: '/admissions', label: 'Admissions', icon: UserPlus },
  timetable: { module: 'timetable', href: '/timetable', label: 'Timetable', icon: CalendarDays },
  homework: { module: 'homework', href: '/homework', label: 'Homework', icon: ClipboardList },
  notices: { module: 'notices', href: '/notices', label: 'Notices', icon: Megaphone },
  certificates: { module: 'certificates', href: '/certificates', label: 'Certificates', icon: ScrollText },
  library: { module: 'library', href: '/library', label: 'Library', icon: Library },
  transport: { module: 'transport', href: '/transport', label: 'Transport', icon: Bus },
  inventory: { module: 'inventory', href: '/inventory', label: 'Inventory', icon: Package },
  hostel: { module: 'hostel', href: '/hostel', label: 'Hostel', icon: BedDouble },
  hr: { module: 'hr', href: '/hr', label: 'HR', icon: IdCard },
  payroll: { module: 'payroll', href: '/payroll', label: 'Payroll', icon: Wallet },
  messages: { module: 'messages', href: '/messages', label: 'Messages', icon: MessageSquare },
};

export function navForRole(role: Role, enabledModules?: string[] | null): NavItem[] {
  const modules = modulesForRole(role, enabledModules).filter((key) => {
    if (key === 'parents' && role !== 'PARENT') return false;
    if (key === 'online_assessments' && role === 'PLATFORM_OPERATOR') return false;
    return true;
  });
  const items = modules
    .map((key) => NAV_BY_MODULE[key])
    .filter((item): item is NavItem => Boolean(item));
  if (role === 'PLATFORM_OPERATOR') {
    items.unshift({
      module: 'dashboard',
      href: '/platform',
      label: 'Master',
      icon: Shield,
    });
  }
  if (modules.includes('students') && (role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN' || role === 'PLATFORM_OPERATOR')) {
    items.push({ module: 'students', href: '/apaar', label: 'APAAR', icon: Fingerprint });
  }
  items.push({ module: 'dashboard', href: '/privacy', label: 'Privacy', icon: Lock });
  return items;
}

export function pathAllowed(role: Role, enabledModules: string[] | null | undefined, pathname: string) {
  return navForRole(role, enabledModules).some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/setup': 'Academic Setup',
  '/students': 'Students',
  '/attendance': 'Attendance',
  '/fees': 'Fees',
  '/exams': 'Exams',
  '/online-exams': 'Online Exams',
  '/parent': 'Parent Portal',
  '/admissions': 'Admissions',
  '/timetable': 'Timetable',
  '/homework': 'Homework',
  '/notices': 'Notices',
  '/certificates': 'Certificates',
  '/library': 'Library',
  '/transport': 'Transport',
  '/inventory': 'Inventory',
  '/hostel': 'Hostel',
  '/hr': 'HR',
  '/payroll': 'Payroll',
  '/messages': 'Messages',
  '/apaar': 'APAAR',
  '/privacy': 'Privacy',
  '/platform': 'Master admin',
};

export { GraduationCap };
