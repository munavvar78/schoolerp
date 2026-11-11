import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { OnlineExamRow } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Card, EmptyState, ErrorBanner, Screen, SkeletonList } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { colors, fonts } from '../theme';

export function OnlineExamsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const exams = useQuery({
    queryKey: ['online-exams', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<OnlineExamRow[]>('/online-assessments'),
  });

  return (
    <Screen
      title="Online exams"
      subtitle="Staff ops · students take in browser"
      back
      refreshing={exams.isRefetching}
      onRefresh={() => void exams.refetch()}
    >
      <Card>
        <Text style={styles.note}>
          Open an exam to enroll a class, go LIVE, monitor attempts, unlock, or add questions. Proctored
          attempts stay in the browser.
        </Text>
      </Card>
      {exams.isLoading ? <SkeletonList /> : null}
      {exams.isError ? (
        <ErrorBanner message={errorText(exams.error)} onRetry={() => void exams.refetch()} />
      ) : null}
      {!exams.isLoading && (exams.data?.length ?? 0) === 0 ? <EmptyState title="No online exams" /> : null}
      {(exams.data ?? []).map((exam) => (
        <Pressable key={exam.id} onPress={() => router.push(`/online-exams/${exam.id}` as Href)}>
          <Card>
            <Text style={styles.title}>{exam.title}</Text>
            <Text style={styles.meta}>Join code {exam.joinCode}</Text>
            <Text style={styles.meta}>
              {exam.durationMinutes} min
              {exam.startsAt ? ` · ${formatDateTime(exam.startsAt)}` : ''}
              {exam.requireCamera ? ' · camera required' : ''}
            </Text>
            <Badge label={exam.status} tone={exam.status === 'LIVE' ? 'success' : 'neutral'} />
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
});
