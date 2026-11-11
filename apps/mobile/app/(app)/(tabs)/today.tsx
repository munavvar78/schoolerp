import { useAuth } from '../../../src/auth/AuthProvider';
import { AttendanceScreen } from '../../../src/screens/AttendanceScreen';
import { FeesScreen } from '../../../src/screens/FeesScreen';
import { HomeworkScreen } from '../../../src/screens/HomeworkScreen';
import { hasModule, MARK_ROLES, roleCan } from '../../../src/lib/roles';

export default function TodayRoute() {
  const { session } = useAuth();
  if (!session) return null;
  if (roleCan(session.role, MARK_ROLES) && hasModule(session, 'attendance')) return <AttendanceScreen />;
  if (session.role === 'ACCOUNTANT') return <FeesScreen />;
  return <HomeworkScreen />;
}
