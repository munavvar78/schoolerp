import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { routeBlocked } from '../../src/lib/roles';
import { colors } from '../../src/theme';

export default function AppLayout() {
  const { ready, session } = useAuth();
  const pathname = usePathname();
  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;
  if (routeBlocked(session, pathname)) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    />
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
