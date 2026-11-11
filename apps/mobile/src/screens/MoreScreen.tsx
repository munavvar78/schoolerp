import { type Href, useRouter } from 'expo-router';
import { MenuRow, Screen } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { hasModule, isFamilyRole, MARK_ROLES, roleCan } from '../lib/roles';

export function MoreScreen() {
  const { session } = useAuth();
  const router = useRouter();
  if (!session) return null;
  const family = isFamilyRole(session.role);
  const attendanceInTab = roleCan(session.role, MARK_ROLES) && hasModule(session, 'attendance');
  const feesInTab = session.role === 'ACCOUNTANT';
  const homeworkInTab = !attendanceInTab && !feesInTab && hasModule(session, 'homework');

  const items: Array<{ title: string; subtitle: string; href: Href; show: boolean }> = [
    {
      title: 'Attendance',
      subtitle: family ? 'Marks for your class' : 'Class sheet',
      href: '/attendance' as Href,
      show: hasModule(session, 'attendance') && !attendanceInTab,
    },
    {
      title: 'Homework',
      subtitle: 'Assignments and due dates',
      href: '/homework' as Href,
      show: hasModule(session, 'homework') && !homeworkInTab,
    },
    {
      title: 'Timetable',
      subtitle: family ? 'Your class periods' : 'Your periods or a class',
      href: '/timetable' as Href,
      show: hasModule(session, 'timetable'),
    },
    {
      title: 'Exams',
      subtitle: 'Papers and published results',
      href: '/exams' as Href,
      show: hasModule(session, 'exams'),
    },
    {
      title: 'Fees',
      subtitle: family ? 'What is due' : 'Outstanding and receipts',
      href: '/fees' as Href,
      show: hasModule(session, 'fees') && !feesInTab,
    },
    {
      title: 'Admissions',
      subtitle: 'Applications and status',
      href: '/admissions' as Href,
      show: hasModule(session, 'admissions'),
    },
    {
      title: 'Certificates',
      subtitle: 'Bonafide, transfer, and fee clearance',
      href: '/certificates' as Href,
      show: hasModule(session, 'certificates'),
    },
    {
      title: 'Library',
      subtitle: 'Books and loans',
      href: '/library' as Href,
      show: hasModule(session, 'library'),
    },
    {
      title: 'Transport',
      subtitle: 'Routes and seats',
      href: '/transport' as Href,
      show: hasModule(session, 'transport'),
    },
    {
      title: 'Inventory',
      subtitle: 'Stock on hand',
      href: '/inventory' as Href,
      show: hasModule(session, 'inventory'),
    },
    {
      title: 'Hostel',
      subtitle: 'Rooms and beds',
      href: '/hostel' as Href,
      show: hasModule(session, 'hostel'),
    },
    {
      title: 'HR',
      subtitle: 'Staff and leave',
      href: '/hr' as Href,
      show: hasModule(session, 'hr'),
    },
    {
      title: 'Payroll',
      subtitle: 'Computed slips',
      href: '/payroll' as Href,
      show: hasModule(session, 'payroll'),
    },
    {
      title: 'Messages',
      subtitle: 'SMS and WhatsApp, fail closed',
      href: '/messages' as Href,
      show: hasModule(session, 'messages'),
    },
    {
      title: 'APAAR',
      subtitle: 'Status only. No Aadhaar.',
      href: '/apaar' as Href,
      show: session.role === 'ORG_OWNER' || session.role === 'CAMPUS_ADMIN' || session.role === 'PLATFORM_OPERATOR',
    },
    {
      title: 'Privacy',
      subtitle: 'Export or request erasure',
      href: '/privacy' as Href,
      show: true,
    },
    {
      title: 'Online exams',
      subtitle: 'Enroll, LIVE, monitor, questions',
      href: '/online-exams' as Href,
      show: hasModule(session, 'online_assessments') && !family && session.role !== 'PLATFORM_OPERATOR',
    },
    {
      title: 'Profile',
      subtitle: session.user.email,
      href: '/profile' as Href,
      show: true,
    },
    {
      title: 'Master',
      subtitle: 'Organizations and modules',
      href: '/platform' as Href,
      show: session.role === 'PLATFORM_OPERATOR',
    },
  ];

  return (
    <Screen title="More" subtitle="The rest of the school day">
      {items
        .filter((item) => item.show)
        .map((item) => (
          <MenuRow key={item.title} title={item.title} subtitle={item.subtitle} onPress={() => router.push(item.href)} />
        ))}
    </Screen>
  );
}
