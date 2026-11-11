import { Pressable, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { HomeworkItem } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Card, EmptyState, ErrorBanner, Screen, SkeletonList } from '../components/ui';
import { formatPrettyDate, isoDateOnly } from '../lib/format';
import { HOMEWORK_WRITE_ROLES, isFamilyRole, roleCan } from '../lib/roles';
import { colors, fonts } from '../theme';

export function HomeworkScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const family = session ? isFamilyRole(session.role) : false;
  const canWrite = roleCan(session?.role, HOMEWORK_WRITE_ROLES);
  const homework = useQuery({
    queryKey: ['homework', family ? 'mine' : 'list', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<HomeworkItem[]>(family ? '/homework/mine' : '/homework'),
  });

  return (
    <Screen
      title="Homework"
      subtitle={family ? 'Assigned to your class' : 'Latest assignments'}
      refreshing={homework.isRefetching}
      onRefresh={() => void homework.refetch()}
      right={
        canWrite ? (
          <Pressable onPress={() => router.push('/compose-homework' as Href)} hitSlop={8}>
            <Text style={styles.new}>New</Text>
          </Pressable>
        ) : null
      }
    >
      {homework.isLoading ? <SkeletonList /> : null}
      {homework.isError ? <ErrorBanner message={errorText(homework.error)} onRetry={() => void homework.refetch()} /> : null}
      {!homework.isLoading && (homework.data?.length ?? 0) === 0 ? (
        <EmptyState title="No homework" body="Assignments created for a class show up here." />
      ) : null}
      {(homework.data ?? []).map((item) => {
        const status = item.childCompletions?.[0]?.status;
        const section = [item.section?.grade?.name, item.section?.name].filter(Boolean).join(' · ');
        return (
          <Card key={item.id}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.subject?.name ?? 'Subject'} · due {formatPrettyDate(isoDateOnly(item.dueDate))}
              {section ? ` · ${section}` : ''}
            </Text>
            {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
            {status ? <Badge label={status} tone={status === 'CHECKED' ? 'success' : status === 'LATE' ? 'danger' : 'brand'} /> : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  new: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand, paddingHorizontal: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
});
