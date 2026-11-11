import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  absentStatusCode,
  lateStatusCode,
  markAttendanceSchema,
  presentStatusCode,
  todayIsoDate,
  validateAttendanceDate,
} from '@school-erp/shared';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { AcademicSession, AttendanceGrid, GradeRow, Student } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, ErrorBanner, Screen, SelectField, SkeletonList, SuccessBanner } from '../components/ui';
import { personName, shiftIsoDate } from '../lib/format';
import { hapticSuccess } from '../lib/haptics';
import { MARK_ROLES, isFamilyRole, roleCan } from '../lib/roles';
import { colors, fonts, radius, space } from '../theme';

export function AttendanceScreen() {
  const { session } = useAuth();
  const client = useQueryClient();
  const canMark = roleCan(session?.role, MARK_ROLES);
  const family = session ? isFamilyRole(session.role) : false;
  const [sectionId, setSectionId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const grades = useQuery({
    queryKey: ['academic', 'grades', session?.campusId],
    enabled: Boolean(session) && !family,
    queryFn: () => apiFetch<GradeRow[]>('/academic/grades'),
  });
  const sessions = useQuery({
    queryKey: ['academic', 'sessions', session?.campusId],
    enabled: Boolean(session) && !family,
    queryFn: () => apiFetch<AcademicSession[]>('/academic/sessions'),
  });

  const children = useQuery({
    queryKey: ['students', 'mine', session?.campusId],
    enabled: Boolean(session && family),
    queryFn: () => apiFetch<Student[]>('/students/my-children'),
  });
  const child = children.data?.[0];
  const childEnrollment = child?.enrollments?.find((item) => item.session?.isCurrent) ?? child?.enrollments?.[0];

  const sections = useMemo(
    () =>
      (grades.data ?? []).flatMap((grade) =>
        grade.sections.map((section) => ({ value: section.id, label: `${grade.name} · ${section.name}` })),
      ),
    [grades.data],
  );

  useEffect(() => {
    if (family) {
      const nextSection = childEnrollment?.sectionId ?? childEnrollment?.section?.id ?? '';
      const nextSession = childEnrollment?.sessionId ?? childEnrollment?.session?.id ?? '';
      if (nextSection) setSectionId(nextSection);
      if (nextSession) setSessionId(nextSession);
      return;
    }
    if (!sessionId && sessions.data?.length) {
      setSessionId((sessions.data.find((item) => item.isCurrent) ?? sessions.data[0])?.id ?? '');
    }
  }, [family, childEnrollment, sessionId, sessions.data]);

  useEffect(() => {
    if (family) return;
    const first = sections[0];
    if (!sectionId && first) setSectionId(first.value);
  }, [family, sectionId, sections]);

  const selectedSession = sessions.data?.find((item) => item.id === sessionId) ?? null;
  const dateRule = validateAttendanceDate(
    date,
    selectedSession?.startDate && selectedSession.endDate
      ? { startDate: selectedSession.startDate, endDate: selectedSession.endDate }
      : null,
  );

  const grid = useQuery({
    queryKey: ['attendance', 'grid', sectionId, sessionId, date],
    enabled: Boolean(sectionId && sessionId && dateRule.ok),
    queryFn: () =>
      apiFetch<AttendanceGrid>(
        `/attendance/grid?sectionId=${encodeURIComponent(sectionId)}&sessionId=${encodeURIComponent(sessionId)}&date=${encodeURIComponent(date)}`,
      ),
  });

  useEffect(() => {
    if (!grid.data) return;
    const present = presentStatusCode(grid.data.statuses) ?? 'PRESENT';
    const next: Record<string, string> = {};
    for (const enrollment of grid.data.enrollments) {
      const existing = grid.data.day?.marks.find((mark) => mark.enrollmentId === enrollment.id);
      next[enrollment.id] = existing?.statusCode ?? present;
    }
    setMarks(next);
    setSaved(next);
  }, [grid.data]);

  const present = presentStatusCode(grid.data?.statuses ?? []) ?? 'PRESENT';
  const absent = absentStatusCode(grid.data?.statuses ?? []);
  const late = lateStatusCode(grid.data?.statuses ?? []);
  const locked = Boolean(grid.data?.day?.locked);
  const dirty = JSON.stringify(marks) !== JSON.stringify(saved);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        sectionId,
        sessionId,
        date,
        marks: (grid.data?.enrollments ?? []).map((enrollment) => ({
          enrollmentId: enrollment.id,
          statusCode: marks[enrollment.id] ?? present,
        })),
      };
      const parsed = markAttendanceSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the attendance sheet');
      return apiFetch<AttendanceGrid>('/attendance/mark', { method: 'POST', json: parsed.data });
    },
    onSuccess: async (next) => {
      client.setQueryData(['attendance', 'grid', sectionId, sessionId, date], next);
      setMessage('Attendance saved');
      await hapticSuccess();
    },
  });

  const roster = (grid.data?.enrollments ?? []).filter((enrollment) => {
    const haystack = `${personName(enrollment.student)} ${enrollment.student.admissionNo} ${enrollment.rollNo ?? ''}`.toLowerCase();
    return haystack.includes(filter.trim().toLowerCase());
  });

  const counts = (grid.data?.enrollments ?? []).reduce(
    (summary, enrollment) => {
      const code = marks[enrollment.id] ?? present;
      if (absent && code === absent) summary.absent += 1;
      else if (late && code === late) summary.late += 1;
      else if (code === present) summary.present += 1;
      else summary.other += 1;
      return summary;
    },
    { present: 0, absent: 0, late: 0, other: 0 },
  );

  const loadingMeta = (!family && grades.isLoading) || (!family && sessions.isLoading);

  return (
    <Screen
      title="Attendance"
      subtitle={locked ? 'This day is locked' : canMark ? 'Tap a status, then save' : 'View only'}
      scroll={false}
      keyboard
      footer={
        canMark && dirty && dateRule.ok && !locked ? (
          <View style={styles.footer}>
            {save.isError ? <ErrorBanner message={errorText(save.error)} /> : null}
            <Button label="Save attendance" loading={save.isPending} onPress={() => save.mutate()} />
          </View>
        ) : null
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
        {loadingMeta ? <SkeletonList rows={2} /> : null}
        {grades.isError ? <ErrorBanner message={errorText(grades.error)} onRetry={() => void grades.refetch()} /> : null}
        {!family && !loadingMeta && sections.length === 0 ? (
          <EmptyState title="No classes yet" body="Create grades and sections in Academic Setup on the web app." />
        ) : null}
        {family ? (
          <Text style={styles.meta}>
            {child ? personName(child) : 'Linked student'}
            {childEnrollment?.section
              ? ` · ${[childEnrollment.section.grade?.name, childEnrollment.section.name].filter(Boolean).join(' ')}`
              : ''}
          </Text>
        ) : (
          <SelectField label="Class" value={sectionId} options={sections} onChange={setSectionId} placeholder="Choose a class" />
        )}
        <SelectField
          label="Session"
          value={sessionId}
          options={(sessions.data ?? []).map((item) => ({ value: item.id, label: item.isCurrent ? `${item.name} · current` : item.name }))}
          onChange={setSessionId}
        />
        <View style={styles.dateRow}>
          <Pressable style={styles.step} onPress={() => setDate((value) => shiftIsoDate(value, -1))}>
            <Text style={styles.stepText}>Prev</Text>
          </Pressable>
          <TextInput
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            style={styles.dateInput}
          />
          <Pressable style={styles.step} onPress={() => setDate((value) => shiftIsoDate(value, 1))}>
            <Text style={styles.stepText}>Next</Text>
          </Pressable>
        </View>
        {!dateRule.ok ? <ErrorBanner message={dateRule.message} /> : null}
        {message && !dirty ? <SuccessBanner message={message} /> : null}
        {grid.isLoading ? <SkeletonList /> : null}
        {grid.isError ? <ErrorBanner message={errorText(grid.error)} onRetry={() => void grid.refetch()} /> : null}
        {grid.data ? (
          <Text style={styles.counts}>
            {counts.present} present · {counts.absent} absent · {counts.late} late
            {counts.other ? ` · ${counts.other} other` : ''}
          </Text>
        ) : null}
        {grid.data ? (
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Filter this class"
            placeholderTextColor={colors.subtle}
            style={styles.filter}
          />
        ) : null}
        {grid.data && roster.length === 0 ? <EmptyState title="No students in this class" /> : null}
        {roster.map((enrollment) => {
          const code = marks[enrollment.id] ?? present;
          return (
            <View key={enrollment.id} style={styles.student}>
              <Text style={styles.name}>{personName(enrollment.student)}</Text>
              <Text style={styles.meta}>
                {enrollment.rollNo ? `Roll ${enrollment.rollNo} · ` : ''}
                {enrollment.student.admissionNo}
              </Text>
              <View style={styles.codes}>
                {[present, absent, late]
                  .filter((value): value is string => Boolean(value))
                  .map((statusCode) => (
                    <Pressable
                      key={statusCode}
                      disabled={!canMark || locked || save.isPending}
                      onPress={() => setMarks((current) => ({ ...current, [enrollment.id]: statusCode }))}
                      style={[styles.code, code === statusCode && styles.codeOn]}
                    >
                      <Text style={[styles.codeText, code === statusCode && styles.codeTextOn]}>
                        {grid.data?.statuses.find((status) => status.code === statusCode)?.label ?? statusCode}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingBottom: 120, gap: space.md },
  dateRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  step: {
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.brandDark },
  dateInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
  },
  counts: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  filter: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  student: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: 6,
  },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  codes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 4 },
  code: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeOn: { backgroundColor: colors.brand },
  codeText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  codeTextOn: { color: colors.white },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
