import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiQuerySchema } from '@school-erp/shared';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { AttendanceRate, CampusInfo, FeeDemand, HomeworkItem, Notice, Overview, Student } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, EmptyState, ErrorBanner, Screen, SkeletonList, Stat, TextField } from '../components/ui';
import { formatInr, formatPrettyDate, personName } from '../lib/format';
import { hapticSuccess } from '../lib/haptics';
import { hasModule, isFamilyRole, ROLE_LABEL } from '../lib/roles';
import { colors, fonts, space } from '../theme';

function Meter({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterValue}>{Math.round(clamped)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%` }]} />
      </View>
    </View>
  );
}

export function HomeScreen() {
  const { session } = useAuth();
  const client = useQueryClient();
  const family = session ? isFamilyRole(session.role) : false;
  const [refreshing, setRefreshing] = useState(false);
  const campus = useQuery({
    queryKey: ['campus', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<CampusInfo>('/academic/campus'),
  });

  if (!session) return null;
  return (
    <Screen
      title={campus.data?.organization?.name ?? 'BharatVidya'}
      subtitle={`${campus.data?.name ?? 'Campus'} · ${ROLE_LABEL[session.role]}`}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void client.invalidateQueries().finally(() => setRefreshing(false));
      }}
    >
      <Text style={styles.hello}>Hello, {session.user.name.split(' ')[0] || session.user.name}</Text>
      {family ? <FamilyHome /> : <StaffHome />}
    </Screen>
  );
}

function StaffHome() {
  const { session } = useAuth();
  const overview = useQuery({
    queryKey: ['overview', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<Overview>('/dashboard/overview'),
  });
  const [question, setQuestion] = useState('What is our fee outstanding and recent attendance?');
  const ask = useMutation({
    mutationFn: async (value: string) => {
      const parsed = aiQuerySchema.safeParse({ question: value });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Enter a question');
      return apiFetch<{ answer: string }>('/ai/ask', { method: 'POST', json: parsed.data });
    },
    onSuccess: () => {
      void hapticSuccess();
    },
  });

  if (overview.isLoading) return <SkeletonList />;
  if (overview.isError) {
    return <ErrorBanner message={errorText(overview.error)} onRetry={() => void overview.refetch()} />;
  }
  const data = overview.data;
  if (!data) return <EmptyState title="No campus snapshot yet" />;

  return (
    <>
      <View style={styles.stats}>
        <Stat label="Students" value={String(data.studentCount)} hint={`${data.sectionCount} sections`} />
        <Stat label="Applications" value={String(data.openApplications ?? 0)} hint="Open admissions" />
        <Stat label="Collected" value={formatInr(data.feeSummary.collected)} tone="success" />
        <Stat label="Outstanding" value={formatInr(data.feeSummary.outstanding)} tone="warning" />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Attendance</Text>
        <Text style={styles.cardHint}>Campus present percentage</Text>
        {data.attendanceTrend.length === 0 ? (
          <EmptyState title="No attendance yet" body="Marks from the last two weeks will show up here." />
        ) : (
          data.attendanceTrend.slice(-7).map((point) => (
            <Meter key={point.date} label={formatPrettyDate(point.date)} value={point.percentage} />
          ))
        )}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Subject averages</Text>
        {data.subjectAverages.length === 0 ? (
          <EmptyState title="No scores yet" />
        ) : (
          data.subjectAverages.map((row) => <Meter key={row.subject} label={row.subject} value={row.average} />)
        )}
      </Card>
      {session && hasModule(session, 'ai') ? (
        <Card>
          <Text style={styles.cardTitle}>Ask the campus</Text>
          <Text style={styles.cardHint}>Answers use live ERP figures. A model key is optional.</Text>
          <TextField
            label="Question"
            value={question}
            onChangeText={setQuestion}
            multiline
            style={styles.question}
          />
          {ask.isError ? <ErrorBanner message={errorText(ask.error)} /> : null}
          <Button label="Ask" loading={ask.isPending} onPress={() => ask.mutate(question)} />
          {ask.data?.answer ? <Text style={styles.answer}>{ask.data.answer}</Text> : null}
        </Card>
      ) : null}
    </>
  );
}

function FamilyHome() {
  const { session } = useAuth();
  const children = useQuery({
    queryKey: ['students', 'mine', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<Student[]>('/students/my-children'),
  });
  const fees = useQuery({
    queryKey: ['fees', 'outstanding', session?.campusId],
    enabled: Boolean(session) && hasModule(session, 'fees'),
    queryFn: () => apiFetch<FeeDemand[]>('/fees/outstanding'),
  });
  const notices = useQuery({
    queryKey: ['notices', 'inbox', session?.campusId],
    enabled: Boolean(session) && hasModule(session, 'notices'),
    queryFn: () => apiFetch<Notice[]>('/notices/inbox'),
  });
  const homework = useQuery({
    queryKey: ['homework', 'mine', session?.campusId],
    enabled: Boolean(session) && hasModule(session, 'homework'),
    queryFn: () => apiFetch<HomeworkItem[]>('/homework/mine'),
  });

  if (children.isLoading) return <SkeletonList />;
  if (children.isError) return <ErrorBanner message={errorText(children.error)} onRetry={() => void children.refetch()} />;
  const kids = children.data ?? [];
  if (kids.length === 0) {
    return (
      <EmptyState
        title="No linked student"
        body="This login is not linked to a child yet. Ask the school office to connect the guardian record."
      />
    );
  }

  const childIds = new Set(kids.map((child) => child.id));
  const outstanding = (fees.data ?? []).filter((demand) => {
    const id = demand.enrollment?.student?.id ?? demand.enrollment?.studentId;
    return id ? childIds.has(id) : false;
  });
  const due = outstanding.reduce((sum, demand) => sum + demand.outstandingPaise, 0);
  const unread = (notices.data ?? []).filter((notice) => (notice.receipts?.length ?? 0) === 0).length;

  return (
    <>
      <View style={styles.stats}>
        <Stat label="Children" value={String(kids.length)} />
        {hasModule(session, 'fees') ? <Stat label="Fees due" value={formatInr(due)} tone={due > 0 ? 'warning' : 'success'} /> : null}
        {hasModule(session, 'notices') ? <Stat label="Unread notices" value={String(unread)} /> : null}
        {hasModule(session, 'homework') ? <Stat label="Homework" value={String(homework.data?.length ?? 0)} /> : null}
      </View>
      {kids.map((child) => (
        <ChildCard key={child.id} child={child} />
      ))}
    </>
  );
}

function ChildCard({ child }: { child: Student }) {
  const enrollment = child.enrollments?.find((item) => item.session?.isCurrent) ?? child.enrollments?.[0];
  const rate = useQuery({
    queryKey: ['attendance', 'rate', enrollment?.id],
    enabled: Boolean(enrollment?.id),
    queryFn: () => apiFetch<AttendanceRate>(`/attendance/rate?enrollmentId=${enrollment?.id}`),
  });
  const section = enrollment?.section;
  const label = section ? [section.grade?.name, section.name].filter(Boolean).join(' · ') : 'Not enrolled';
  return (
    <Card>
      <Text style={styles.cardTitle}>{personName(child)}</Text>
      <Text style={styles.cardHint}>
        {child.admissionNo} · {label}
      </Text>
      <Text style={styles.rate}>
        {rate.isLoading ? 'Loading attendance…' : rate.isError ? 'Attendance unavailable' : `${Math.round(rate.data?.percentage ?? 0)}% attendance`}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hello: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  cardHint: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  rate: { fontFamily: fonts.medium, fontSize: 16, color: colors.brandDark, marginTop: space.xs },
  meter: { gap: 6, marginTop: space.sm },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  meterValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  track: { height: 8, borderRadius: 99, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 99, backgroundColor: colors.brand },
  question: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  answer: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: space.md,
  },
});
