import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { OnlineExamDetail, OnlineQuestionOption } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button, ErrorBanner, Screen, SelectField, TextField } from '../components/ui';
import { hapticSuccess } from '../lib/haptics';
import { colors, fonts } from '../theme';

type StaffQuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'YES_NO' | 'THIS_OR_THAT';

function optionId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultOptions(type: StaffQuestionType): OnlineQuestionOption[] {
  if (type === 'YES_NO') {
    return [
      { id: 'yes', text: 'Yes', isCorrect: true },
      { id: 'no', text: 'No', isCorrect: false },
    ];
  }
  if (type === 'THIS_OR_THAT') {
    return [
      { id: 'this', text: 'This', isCorrect: true },
      { id: 'that', text: 'That', isCorrect: false },
    ];
  }
  if (type === 'MULTIPLE_CHOICE') {
    return [
      { id: optionId('a'), text: 'Option A', isCorrect: true },
      { id: optionId('b'), text: 'Option B', isCorrect: true },
      { id: optionId('c'), text: 'Option C', isCorrect: false },
      { id: optionId('d'), text: 'Option D', isCorrect: false },
    ];
  }
  return [
    { id: optionId('a'), text: 'Option A', isCorrect: true },
    { id: optionId('b'), text: 'Option B', isCorrect: false },
    { id: optionId('c'), text: 'Option C', isCorrect: false },
    { id: optionId('d'), text: 'Option D', isCorrect: false },
  ];
}

function normalizeType(type: string): StaffQuestionType {
  if (type === 'MULTIPLE_CHOICE' || type === 'YES_NO' || type === 'THIS_OR_THAT') return type;
  return 'SINGLE_CHOICE';
}

export function OnlineExamQuestionScreen({
  assessmentId,
  questionId,
}: {
  assessmentId: string;
  questionId?: string;
}) {
  const { session } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const editing = Boolean(questionId);

  const [type, setType] = useState<StaffQuestionType>('SINGLE_CHOICE');
  const [stem, setStem] = useState('');
  const [marks, setMarks] = useState('1');
  const [options, setOptions] = useState<OnlineQuestionOption[]>(defaultOptions('SINGLE_CHOICE'));
  const [formError, setFormError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['online-exams', assessmentId],
    enabled: Boolean(session && assessmentId),
    queryFn: () => apiFetch<OnlineExamDetail>(`/online-assessments/${assessmentId}`),
  });

  useEffect(() => {
    if (!editing || !detail.data) return;
    const q = detail.data.questions.find((row) => row.id === questionId);
    if (!q) return;
    const nextType = normalizeType(q.type);
    setType(nextType);
    setStem(q.stem);
    setMarks(String(q.marks));
    setOptions(
      (q.options ?? []).map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: Boolean(o.isCorrect),
      })),
    );
  }, [editing, questionId, detail.data]);

  const typeOptions = useMemo(
    () => [
      { value: 'SINGLE_CHOICE', label: 'Single choice' },
      { value: 'MULTIPLE_CHOICE', label: 'Multiple correct' },
      { value: 'YES_NO', label: 'Yes / No' },
      { value: 'THIS_OR_THAT', label: 'This or that' },
    ],
    [],
  );

  function onChangeType(next: string) {
    const t = normalizeType(next);
    setType(t);
    setOptions(defaultOptions(t));
  }

  function setCorrect(optionIdValue: string, multi: boolean) {
    setOptions((prev) =>
      prev.map((o) => {
        if (multi) {
          return o.id === optionIdValue ? { ...o, isCorrect: !o.isCorrect } : o;
        }
        return { ...o, isCorrect: o.id === optionIdValue };
      }),
    );
  }

  function validate(): string | null {
    if (!stem.trim()) return 'Enter the question stem';
    const marksNum = Number(marks);
    if (!Number.isFinite(marksNum) || marksNum <= 0) return 'Marks must be a positive number';
    if (options.some((o) => !o.text.trim())) return 'All options need text';
    const correct = options.filter((o) => o.isCorrect).length;
    if (type === 'MULTIPLE_CHOICE' && correct < 2) return 'Pick at least two correct options';
    if (type !== 'MULTIPLE_CHOICE' && correct !== 1) return 'Pick exactly one correct option';
    if ((type === 'YES_NO' || type === 'THIS_OR_THAT') && options.length !== 2) {
      return 'This type needs exactly two options';
    }
    return null;
  }

  const save = useMutation({
    mutationFn: async () => {
      const err = validate();
      if (err) {
        setFormError(err);
        throw new Error(err);
      }
      setFormError(null);
      const payload = {
        type,
        stem: stem.trim(),
        marks: Number(marks),
        sortOrder: editing
          ? detail.data?.questions.find((q) => q.id === questionId)?.sortOrder ?? 0
          : detail.data?.questions.length ?? 0,
        options: options.map((o) => ({
          id: o.id,
          text: o.text.trim(),
          isCorrect: o.isCorrect,
        })),
      };
      if (editing && questionId) {
        return apiFetch('/online-assessments/questions', {
          method: 'PUT',
          json: { assessmentId, questionId, question: payload },
        });
      }
      return apiFetch('/online-assessments/questions', {
        method: 'POST',
        json: { assessmentId, question: payload },
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['online-exams', assessmentId] });
      await client.invalidateQueries({ queryKey: ['online-exams'] });
      await hapticSuccess();
      router.back();
    },
  });

  const multi = type === 'MULTIPLE_CHOICE';
  const fixedTwo = type === 'YES_NO' || type === 'THIS_OR_THAT';

  return (
    <Screen title={editing ? 'Edit question' : 'Add question'} subtitle="Same types as web" back keyboard>
      <SelectField label="Type" value={type} options={typeOptions} onChange={onChangeType} />
      <TextField
        label="Question"
        value={stem}
        onChangeText={setStem}
        multiline
        style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }}
      />
      <TextField label="Marks" value={marks} onChangeText={setMarks} keyboardType="decimal-pad" />

      <Text style={styles.section}>Options · tap to mark correct</Text>
      {options.map((opt, idx) => (
        <View key={opt.id} style={styles.optionCard}>
          <Pressable onPress={() => setCorrect(opt.id, multi)} style={styles.correctToggle}>
            <Text style={styles.correctLabel}>{opt.isCorrect ? '✓ Correct' : 'Mark correct'}</Text>
          </Pressable>
          <TextField
            label={`Option ${idx + 1}`}
            value={opt.text}
            onChangeText={(text) =>
              setOptions((prev) => prev.map((o) => (o.id === opt.id ? { ...o, text } : o)))
            }
            editable={type !== 'YES_NO'}
          />
        </View>
      ))}

      {!fixedTwo ? (
        <View style={styles.row}>
          <Button
            label="Add option"
            variant="secondary"
            onPress={() => {
              if (options.length >= 8) return;
              setOptions((prev) => [
                ...prev,
                { id: optionId('o'), text: `Option ${prev.length + 1}`, isCorrect: false },
              ]);
            }}
          />
          {options.length > 2 ? (
            <Button
              label="Remove last"
              variant="ghost"
              onPress={() => setOptions((prev) => prev.slice(0, -1))}
            />
          ) : null}
        </View>
      ) : null}

      {formError ? <ErrorBanner message={formError} /> : null}
      {save.isError ? <ErrorBanner message={errorText(save.error)} /> : null}
      <Button
        label={editing ? 'Save question' : 'Add question'}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  optionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: colors.card,
  },
  correctToggle: { marginBottom: 6 },
  correctLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.brand },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
});
