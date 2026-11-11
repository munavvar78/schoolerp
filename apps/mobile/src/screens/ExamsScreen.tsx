import { Pressable, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { ExamRow } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Card, EmptyState, ErrorBanner, Screen, SkeletonList } from '../components/ui';
import { formatPrettyDate, isoDateOnly } from '../lib/format';
import { colors, fonts } from '../theme';

export function ExamsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const exams = useQuery({
    queryKey: ['exams', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<ExamRow[]>('/exams'),
  });

  return (
    <Screen title="Exams" subtitle="Results and papers" back refreshing={exams.isRefetching} onRefresh={() => void exams.refetch()}>
      {exams.isLoading ? <SkeletonList /> : null}
      {exams.isError ? <ErrorBanner message={errorText(exams.error)} onRetry={() => void exams.refetch()} /> : null}
      {!exams.isLoading && (exams.data?.length ?? 0) === 0 ? <EmptyState title="No exams yet" /> : null}
      {(exams.data ?? []).map((exam) => {
        const published = Boolean(exam.publishedAt) || (exam.publications?.length ?? 0) > 0;
        return (
          <Pressable key={exam.id} onPress={() => router.push(`/exam/${exam.id}` as Href)}>
            <Card>
              <Text style={styles.title}>{exam.name}</Text>
              <Text style={styles.meta}>
                {[exam.grade?.name, exam.session?.name, exam.startDate ? formatPrettyDate(isoDateOnly(exam.startDate)) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Badge label={published ? 'Published' : 'Draft'} tone={published ? 'success' : 'neutral'} />
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
});
