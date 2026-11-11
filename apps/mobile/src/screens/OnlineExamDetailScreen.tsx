import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { GradeRow, OnlineExamDetail } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Button, Card, EmptyState, ErrorBanner, Screen, SelectField, SkeletonList } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { colors, fonts } from '../theme';

function typeBadge(type: string) {
  if (type === 'MULTIPLE_CHOICE') return 'Multi';
  if (type === 'YES_NO') return 'Yes/No';
  if (type === 'THIS_OR_THAT') return 'This/That';
  return 'Single';
}

export function OnlineExamDetailScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const [sectionId, setSectionId] = useState('');
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const canUnlock =
    session?.role === 'ORG_OWNER' || session?.role === 'CAMPUS_ADMIN' || session?.role === 'CLASS_TEACHER';

  const detail = useQuery({
    queryKey: ['online-exams', id],
    enabled: Boolean(session && id),
    refetchInterval: (query) => (query.state.data?.status === 'LIVE' ? 18_000 : false),
    queryFn: () => apiFetch<OnlineExamDetail>(`/online-assessments/${id}`),
  });

  const grades = useQuery({
    queryKey: ['academic', 'grades', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<GradeRow[]>('/academic/grades'),
  });

  const sections = useMemo(
    () =>
      (grades.data ?? []).flatMap((grade) =>
        grade.sections.map((section) => ({
          value: section.id,
          label: `${grade.name} · ${section.name}`,
        })),
      ),
    [grades.data],
  );

  useEffect(() => {
    setActionError(null);
  }, [id]);

  const enroll = useMutation({
    mutationFn: () =>
      apiFetch<{ created: number; totalEligible: number }>('/online-assessments/enroll-section', {
        method: 'POST',
        json: { assessmentId: id, sectionId },
      }),
    onSuccess: async () => {
      setActionError(null);
      await client.invalidateQueries({ queryKey: ['online-exams', id] });
      await client.invalidateQueries({ queryKey: ['online-exams'] });
    },
    onError: (err) => setActionError(errorText(err)),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      apiFetch('/online-assessments/status', {
        method: 'POST',
        json: { assessmentId: id, status },
      }),
    onSuccess: async () => {
      setActionError(null);
      await client.invalidateQueries({ queryKey: ['online-exams', id] });
      await client.invalidateQueries({ queryKey: ['online-exams'] });
    },
    onError: (err) => setActionError(errorText(err)),
  });

  const unlock = useMutation({
    mutationFn: (attemptId: string) =>
      apiFetch('/online-assessments/unlock', {
        method: 'POST',
        json: { attemptId, resetWarnings: false },
      }),
    onSuccess: async () => {
      setActionError(null);
      await client.invalidateQueries({ queryKey: ['online-exams', id] });
    },
    onError: (err) => setActionError(errorText(err)),
  });

  const exam = detail.data;

  return (
    <Screen
      title={exam?.title ?? 'Online exam'}
      subtitle={exam ? `Join ${exam.joinCode}` : undefined}
      back
      refreshing={detail.isRefetching}
      onRefresh={() => void detail.refetch()}
    >
      {detail.isLoading ? <SkeletonList /> : null}
      {detail.isError ? (
        <ErrorBanner message={errorText(detail.error)} onRetry={() => void detail.refetch()} />
      ) : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}

      {exam ? (
        <>
          <Card>
            <View style={styles.row}>
              <Badge label={exam.status} tone={exam.status === 'LIVE' ? 'success' : 'neutral'} />
              <Text style={styles.meta}>
                {exam.durationMinutes} min · camera {exam.requireCamera ? 'on' : 'off'} · max warn{' '}
                {exam.maxWarnings}
              </Text>
            </View>
            {exam.status === 'LIVE' ? (
              <Text style={styles.liveHint}>Live — auto-refreshing about every 18s</Text>
            ) : null}
            <View style={styles.actions}>
              <Button
                label="Set LIVE"
                loading={setStatus.isPending && setStatus.variables === 'LIVE'}
                onPress={() => setStatus.mutate('LIVE')}
              />
              <Button
                label="Close"
                variant="secondary"
                loading={setStatus.isPending && setStatus.variables === 'CLOSED'}
                onPress={() => setStatus.mutate('CLOSED')}
              />
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Enroll class</Text>
            <SelectField label="Section" value={sectionId} options={sections} onChange={setSectionId} />
            <Button
              label={
                enroll.isSuccess
                  ? `Enrolled ${enroll.data.created}/${enroll.data.totalEligible}`
                  : 'Enroll section'
              }
              loading={enroll.isPending}
              onPress={() => {
                if (!sectionId) {
                  setActionError('Pick a section first');
                  return;
                }
                enroll.mutate();
              }}
            />
            <Text style={styles.meta}>Enrolled students: {exam.enrollments?.length ?? 0}</Text>
          </Card>

          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Questions ({exam.questions?.length ?? 0})</Text>
              <Pressable
                onPress={() =>
                  router.push(`/online-exams/${id}/question` as Href)
                }
              >
                <Text style={styles.link}>Add</Text>
              </Pressable>
            </View>
            {(exam.questions ?? []).length === 0 ? (
              <EmptyState title="No questions" body="Add a question on this phone or on the web." />
            ) : (
              (exam.questions ?? []).map((q, idx) => (
                <Pressable
                  key={q.id}
                  style={styles.questionRow}
                  onPress={() =>
                    router.push(`/online-exams/${id}/question?questionId=${q.id}` as Href)
                  }
                >
                  <View style={styles.row}>
                    <Text style={styles.qIndex}>Q{idx + 1}</Text>
                    <Badge label={typeBadge(q.type)} tone="neutral" />
                    <Text style={styles.meta}>
                      {q.marks} mark{q.marks === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={styles.stem} numberOfLines={2}>
                    {q.stem}
                  </Text>
                </Pressable>
              ))
            )}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Attempts ({exam.attempts?.length ?? 0})</Text>
            {(exam.attempts ?? []).length === 0 ? (
              <EmptyState title="No attempts yet" />
            ) : (
              (exam.attempts ?? []).map((a) => {
                const expanded = expandedAttemptId === a.id;
                const events = a.proctorEvents ?? [];
                return (
                  <View key={a.id} style={styles.attempt}>
                    <Text style={styles.title}>
                      {a.enrollment.student.admissionNo} · {a.enrollment.student.firstName}
                    </Text>
                    <Text style={styles.meta}>
                      {a.status} · warn {a.warningCount}
                      {a.score != null ? ` · ${a.score}/${a.maxScore ?? '—'}` : ''}
                    </Text>
                    {a.lockReasonMessage ? (
                      <Text style={styles.lock}>{a.lockReasonMessage}</Text>
                    ) : null}
                    <View style={styles.actions}>
                      <Button
                        label={expanded ? 'Hide events' : `Events (${events.length})`}
                        variant="secondary"
                        onPress={() => setExpandedAttemptId((cur) => (cur === a.id ? null : a.id))}
                      />
                      {canUnlock && a.status === 'LOCKED' ? (
                        <Button
                          label="Unlock"
                          loading={unlock.isPending && unlock.variables === a.id}
                          onPress={() => unlock.mutate(a.id)}
                        />
                      ) : null}
                    </View>
                    {expanded ? (
                      <View style={styles.events}>
                        {events.length === 0 ? (
                          <Text style={styles.meta}>No proctor events</Text>
                        ) : (
                          events.map((ev) => (
                            <Text key={ev.id} style={styles.eventLine}>
                              {formatDateTime(ev.at)} · {ev.type}
                              {ev.message ? ` — ${ev.message}` : ''}
                            </Text>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, marginBottom: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  liveHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.brand, marginTop: 6 },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.brand },
  questionRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  qIndex: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  stem: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, marginTop: 4 },
  attempt: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lock: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginTop: 4 },
  events: { marginTop: 8, gap: 4 },
  eventLine: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
