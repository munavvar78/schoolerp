import { Alert, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiBase, apiFetch, logout } from '../api/client';
import type { CampusInfo } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Screen } from '../components/ui';
import { ROLE_LABEL } from '../lib/roles';
import { colors, fonts } from '../theme';

export function ProfileScreen() {
  const { session } = useAuth();
  const campus = useQuery({
    queryKey: ['campus', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<CampusInfo>('/academic/campus'),
  });

  if (!session) return null;
  return (
    <Screen title="Profile" back>
      <Card>
        <Text style={styles.name}>{session.user.name}</Text>
        <Text style={styles.meta}>{session.user.email}</Text>
        <Text style={styles.meta}>{ROLE_LABEL[session.role]}</Text>
        <Text style={styles.meta}>
          {campus.data?.organization?.name ?? 'School'} · {campus.data?.name ?? 'Campus'}
        </Text>
      </Card>
      <Card>
        <Text style={styles.label}>API</Text>
        <Text style={styles.meta}>{apiBase()}</Text>
      </Card>
      <Button
        label="Sign out"
        variant="danger"
        onPress={() => {
          Alert.alert('Sign out', 'You will need your password to open the app again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
          ]);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  meta: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, lineHeight: 24 },
});
