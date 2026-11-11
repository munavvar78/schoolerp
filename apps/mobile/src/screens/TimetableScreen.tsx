import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { AcademicSession, GradeRow, Student, TimetableEntry } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Card, EmptyState, ErrorBanner, Screen, SelectField, SkeletonList } from '../components/ui';
import { personName, weekdayName } from '../lib/format';
import { isFamilyRole } from '../lib/roles';
import { colors, fonts, radius, space } from '../theme';

export function TimetableScreen() {
  const { session } = useAuth();
  const family = session ? isFamilyRole(session.role) : false;
  const [mode, setMode] = useState<'mine' | 'section'>(family ? 'section' : 'mine');
  const [sessionId, setSessionId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [childId, setChildId] = useState('');

  const sessions = useQuery({
    queryKey: ['academic', 'sessions', session?.campusId],
    enabled: Boolean(session) && !family,
    queryFn: () => apiFetch<AcademicSession[]>('/academic/sessions'),
  });
  const grades = useQuery({
    queryKey: ['academic', 'grades', session?.campusId],
    enabled: Boolean(session) && !family,
    queryFn: () => apiFetch<GradeRow[]>('/academic/grades'),
  });
  const children = useQuery({
    queryKey: ['students', 'mine', session?.campusId],
    enabled: Boolean(session && family),
    queryFn: () => apiFetch<Student[]>('/students/my-children'),
  });

  useEffect(() => {
    if (!sessionId && sessions.data?.length) {
      setSessionId((sessions.data.find((item) => item.isCurrent) ?? sessions.data[0])?.id ?? '');
    }
  }, [sessionId, sessions.data]);

  const child = children.data?.find((item) => item.id === childId) ?? children.data?.[0];
  const childEnrollment = child?.enrollments?.find((item) => item.session?.isCurrent) ?? child?.enrollments?.[0];
  const activeSection = family ? (childEnrollment?.sectionId ?? childEnrollment?.section?.id ?? '') : sectionId;
  const activeSession = family ? (childEnrollment?.sessionId ?? childEnrollment?.session?.id ?? sessionId) : sessionId;

  const sections = useMemo(
    () =>
      (grades.data ?? []).flatMap((grade) =>
        grade.sections.map((section) => ({ value: section.id, label: `${grade.name} · ${section.name}` })),
      ),
    [grades.data],
  );

  const mine = useQuery({
    queryKey: ['timetable', 'mine', session?.campusId, sessionId],
    enabled: Boolean(session && !family && mode === 'mine' && sessionId),
    queryFn: () => apiFetch<TimetableEntry[]>(`/timetable/mine?sessionId=${encodeURIComponent(sessionId)}`),
  });
  const bySection = useQuery({
    queryKey: ['timetable', 'section', activeSection, activeSession],
    enabled: Boolean((family || mode === 'section') && activeSection && activeSession),
    queryFn: () =>
      apiFetch<TimetableEntry[]>(
        `/timetable/section?sectionId=${encodeURIComponent(activeSection)}&sessionId=${encodeURIComponent(activeSession)}`,
      ),
  });

  const query = family || mode === 'section' ? bySection : mine;
  const grouped = new Map<number, TimetableEntry[]>();
  for (const entry of query.data ?? []) {
    const list = grouped.get(entry.dayOfWeek) ?? [];
    list.push(entry);
    grouped.set(entry.dayOfWeek, list);
  }

  return (
    <Screen title="Timetable" subtitle={family ? personName(child ?? { firstName: 'Class' }) : 'Periods for the session'} back refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {!family ? (
        <View style={styles.switch}>
          <Pressable onPress={() => setMode('mine')} style={[styles.switchItem, mode === 'mine' && styles.switchOn]}>
            <Text style={[styles.switchText, mode === 'mine' && styles.switchTextOn]}>My periods</Text>
          </Pressable>
          <Pressable onPress={() => setMode('section')} style={[styles.switchItem, mode === 'section' && styles.switchOn]}>
            <Text style={[styles.switchText, mode === 'section' && styles.switchTextOn]}>A class</Text>
          </Pressable>
        </View>
      ) : null}
      {family && (children.data?.length ?? 0) > 1 ? (
        <SelectField
          label="Child"
          value={child?.id ?? ''}
          options={(children.data ?? []).map((item) => ({ value: item.id, label: personName(item) }))}
          onChange={setChildId}
        />
      ) : null}
      {!family ? (
        <SelectField
          label="Session"
          value={sessionId}
          options={(sessions.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
          onChange={setSessionId}
        />
      ) : null}
      {!family && mode === 'section' ? <SelectField label="Class" value={sectionId} options={sections} onChange={setSectionId} /> : null}
      {query.isLoading ? <SkeletonList /> : null}
      {query.isError ? <ErrorBanner message={errorText(query.error)} onRetry={() => void query.refetch()} /> : null}
      {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
        <EmptyState title="No periods" body="Timetable entries saved for this session will show up here." />
      ) : null}
      {[1, 2, 3, 4, 5, 6, 7].map((day) => {
        const entries = grouped.get(day);
        if (!entries?.length) return null;
        return (
          <Card key={day}>
            <Text style={styles.day}>{weekdayName(day)}</Text>
            {entries.map((entry) => (
              <Text key={entry.id} style={styles.period}>
                {entry.periodSlot?.startTime ?? ''}–{entry.periodSlot?.endTime ?? ''} · {entry.subject?.name ?? entry.periodSlot?.label ?? 'Period'}
                {entry.section ? ` · ${[entry.section.grade?.name, entry.section.name].filter(Boolean).join(' ')}` : ''}
              </Text>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 4 },
  switchItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  switchOn: { backgroundColor: colors.brandSoft },
  switchText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  switchTextOn: { color: colors.brandDark },
  day: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  period: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, lineHeight: 22 },
});
