import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { createHomeworkSchema, todayIsoDate } from '@school-erp/shared';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { AcademicSession, GradeRow, SubjectRow } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button, ErrorBanner, Screen, SelectField, TextField } from '../components/ui';
import { hapticSuccess } from '../lib/haptics';

export function ComposeHomeworkScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const [sessionId, setSessionId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sessions = useQuery({
    queryKey: ['academic', 'sessions', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<AcademicSession[]>('/academic/sessions'),
  });
  const grades = useQuery({
    queryKey: ['academic', 'grades', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<GradeRow[]>('/academic/grades'),
  });
  const subjects = useQuery({
    queryKey: ['academic', 'subjects', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<SubjectRow[]>('/academic/subjects'),
  });

  const sections = useMemo(
    () =>
      (grades.data ?? []).flatMap((grade) =>
        grade.sections.map((section) => ({ value: section.id, label: `${grade.name} · ${section.name}` })),
      ),
    [grades.data],
  );

  useEffect(() => {
    if (!sessionId && sessions.data?.length) {
      setSessionId((sessions.data.find((item) => item.isCurrent) ?? sessions.data[0])?.id ?? '');
    }
  }, [sessionId, sessions.data]);

  const create = useMutation({
    mutationFn: async () => {
      const parsed = createHomeworkSchema.safeParse({
        sessionId,
        sectionId,
        subjectId,
        title,
        description: description.trim() || undefined,
        dueDate,
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          if (!next[key]) next[key] = issue.message;
        }
        setErrors(next);
        throw new Error(parsed.error.issues[0]?.message ?? 'Check the assignment');
      }
      setErrors({});
      return apiFetch('/homework', { method: 'POST', json: parsed.data });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['homework'] });
      await hapticSuccess();
      router.back();
    },
  });

  return (
    <Screen title="New homework" subtitle="Assigned to one class" back keyboard>
      <SelectField
        label="Session"
        value={sessionId}
        options={(sessions.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
        onChange={setSessionId}
      />
      <SelectField label="Class" value={sectionId} options={sections} onChange={setSectionId} />
      <SelectField
        label="Subject"
        value={subjectId}
        options={(subjects.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
        onChange={setSubjectId}
      />
      <TextField label="Title" value={title} onChangeText={setTitle} error={errors.title} />
      <TextField label="Details" value={description} onChangeText={setDescription} multiline style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }} />
      <TextField label="Due date" value={dueDate} onChangeText={setDueDate} autoCapitalize="none" error={errors.dueDate} placeholder="YYYY-MM-DD" />
      {errors.sectionId || errors.subjectId || errors.sessionId ? (
        <ErrorBanner message={errors.sectionId || errors.subjectId || errors.sessionId || 'Check the class'} />
      ) : null}
      {create.isError ? <ErrorBanner message={errorText(create.error)} /> : null}
      <Button label="Assign homework" loading={create.isPending} onPress={() => create.mutate()} />
    </Screen>
  );
}
