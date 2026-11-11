import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useAuth } from '../../../src/auth/AuthProvider';
import { hasModule, isFamilyRole, MARK_ROLES, roleCan } from '../../../src/lib/roles';
import { colors, fonts } from '../../../src/theme';

function tint(color: unknown): string {
  return typeof color === 'string' ? color : colors.muted;
}

export default function TabsLayout() {
  const { session } = useAuth();
  const family = session ? isFamilyRole(session.role) : false;
  const showPeople = session ? hasModule(session, 'students') || hasModule(session, 'parents') : false;
  const showAttendance = session ? roleCan(session.role, MARK_ROLES) && hasModule(session, 'attendance') : false;
  const showFees = session?.role === 'ACCOUNTANT';
  const showHomework = Boolean(session && !showAttendance && !showFees && hasModule(session, 'homework'));
  const showToday = showAttendance || showFees || showHomework;
  const showNotices = session ? hasModule(session, 'notices') : false;
  const todayTitle = showFees ? 'Fees' : showHomework ? 'Homework' : 'Attendance';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={tint(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: family ? 'Children' : 'Students',
          href: showPeople ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={tint(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: todayTitle,
          href: showToday ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={showFees ? 'receipt-outline' : showHomework ? 'create-outline' : 'checkmark-done-outline'}
              color={tint(color)}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: 'Notices',
          href: showNotices ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="megaphone-outline" color={tint(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={tint(color)} size={size} />,
        }}
      />
    </Tabs>
  );
}
