import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text } from 'react-native';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { ExamResult, ExamRow, Student } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Card, EmptyState, ErrorBanner, Screen, SkeletonList } from '../components/ui';
import { personName } from '../lib/format';
import { isFamilyRole } from '../lib/roles';
import { colors, fonts } from '../theme';

export function ExamDetailScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const family = session ? isFamilyRole(session.role) : false;
  const exams = useQuery({
    queryKey: ['exams', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<ExamRow[]>('/exams'),
  });
  const children = useQuery({
    queryKey: ['students', 'mine', session?.campusId],
    enabled: Boolean(session && family),
    queryFn: () => apiFetch<Student[]>('/students/my-children'),
  });
  const results = useQuery({
    queryKey: ['exams', id, 'results'],
    enabled: Boolean(session && id),
    queryFn: () => apiFetch<ExamResult[]>(`/exams/${id}/results`),
  });

  const exam = exams.data?.find((item) => item.id === id);
  const enrollmentIds = new Set((children.data ?? []).flatMap((child) => (child.enrollments ?? []).map((enrollment) => enrollment.id)));
  const rows = family ? (results.data ?? []).filter((row) => enrollmentIds.has(row.enrollmentId)) : (results.data ?? []);

  return (
    <Screen title={exam?.name ?? 'Results'} subtitle={exam?.grade?.name} back refreshing={results.isRefetching} onRefresh={() => void results.refetch()}>
      {results.isLoading ? <SkeletonList /> : null}
      {results.isError ? <ErrorBanner message={errorText(results.error)} onRetry={() => void results.refetch()} /> : null}
      {!results.isLoading && !results.isError && rows.length === 0 ? (
        <EmptyState title="No results to show" body={family ? 'Published marks for your child will appear here.' : 'Enter scores on the web app to see them here.'} />
      ) : null}
      {rows.map((row) => (
        <Card key={row.enrollmentId}>
          <Text style={styles.name}>{personName(row.student)}</Text>
          <Text style={styles.meta}>
            {row.totals.percentage}% · {row.totals.obtained}/{row.totals.max}
          </Text>
          <Badge label={row.grade.grade} tone={row.grade.isPass ? 'success' : 'danger'} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
});
