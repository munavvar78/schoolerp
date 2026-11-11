import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { AttendanceRate, Student } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Card, EmptyState, ErrorBanner, Screen, SkeletonList } from '../components/ui';
import { formatPrettyDate, isoDateOnly, personName } from '../lib/format';
import { isFamilyRole } from '../lib/roles';
import { fonts, colors } from '../theme';
import { StyleSheet, Text } from 'react-native';

function findCachedStudent(rows: Array<[readonly unknown[], Student[] | undefined]>, id: string): Student | undefined {
  for (const [, list] of rows) {
    const hit = list?.find((student) => student.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export function StudentDetailScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const family = session ? isFamilyRole(session.role) : false;
  const student = useQuery({
    queryKey: ['student', id, session?.campusId],
    enabled: Boolean(session && id),
    queryFn: async () => {
      const cached = findCachedStudent(client.getQueriesData<Student[]>({ queryKey: ['students'] }), id);
      if (family) {
        const rows = await apiFetch<Student[]>('/students/my-children');
        return rows.find((row) => row.id === id) ?? null;
      }
      if (cached) {
        const rows = await apiFetch<Student[]>(`/students?q=${encodeURIComponent(cached.admissionNo)}`);
        return rows.find((row) => row.id === id) ?? cached;
      }
      const rows = await apiFetch<Student[]>('/students');
      return rows.find((row) => row.id === id) ?? null;
    },
  });

  if (student.isLoading) {
    return (
      <Screen title="Student" back>
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  if (student.isError) {
    return (
      <Screen title="Student" back>
        <ErrorBanner message={errorText(student.error)} onRetry={() => void student.refetch()} />
      </Screen>
    );
  }
  const row = student.data;
  if (!row) {
    return (
      <Screen title="Student" back>
        <EmptyState
          title="Student not in this list"
          body="The directory loads up to 200 students. Search from the Students tab, then open the record again."
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={personName(row)}
      subtitle={row.admissionNo}
      back
      refreshing={student.isRefetching}
      onRefresh={() => void student.refetch()}
    >
      <Card>
        <Text style={styles.label}>Profile</Text>
        <Text style={styles.line}>{row.gender ? row.gender.toLowerCase() : 'Gender not set'}</Text>
        <Text style={styles.line}>{row.dateOfBirth ? `Born ${formatPrettyDate(isoDateOnly(row.dateOfBirth))}` : 'Date of birth not set'}</Text>
      </Card>
      <Card>
        <Text style={styles.label}>Classes</Text>
        {(row.enrollments ?? []).length === 0 ? <EmptyState title="Not enrolled" /> : null}
        {(row.enrollments ?? []).map((enrollment) => (
          <EnrollmentRate key={enrollment.id} enrollmentId={enrollment.id} label={[enrollment.session?.name, enrollment.section?.grade?.name, enrollment.section?.name, enrollment.rollNo ? `Roll ${enrollment.rollNo}` : null].filter(Boolean).join(' · ')} />
        ))}
      </Card>
      <Card>
        <Text style={styles.label}>Guardians</Text>
        {(row.guardians ?? []).length === 0 ? <EmptyState title="No guardians on file" /> : null}
        {(row.guardians ?? []).map((link, index) => (
          <Text key={`${link.guardian?.name ?? 'guardian'}-${index}`} style={styles.line}>
            {link.guardian?.name ?? 'Guardian'} · {link.guardian?.relation ?? 'Contact'}
            {link.guardian?.phone ? ` · ${link.guardian.phone}` : ''}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}

function EnrollmentRate({ enrollmentId, label }: { enrollmentId: string; label: string }) {
  const rate = useQuery({
    queryKey: ['attendance', 'rate', enrollmentId],
    queryFn: () => apiFetch<AttendanceRate>(`/attendance/rate?enrollmentId=${enrollmentId}`),
  });
  return (
    <Text style={styles.line}>
      {label || 'Enrollment'}
      {rate.data ? ` · ${Math.round(rate.data.percentage)}% present` : rate.isError ? ' · attendance unavailable' : ' · …'}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  line: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, lineHeight: 24 },
});
