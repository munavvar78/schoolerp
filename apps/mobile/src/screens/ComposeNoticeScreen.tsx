import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { createNoticeSchema } from '@school-erp/shared';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import { Button, ErrorBanner, Screen, TextField } from '../components/ui';
import { hapticSuccess } from '../lib/haptics';
import { colors, fonts, radius, space } from '../theme';

const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'] as const;

export function ComposeNoticeScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Academic');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('NORMAL');
  const [publish, setPublish] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: async () => {
      const parsed = createNoticeSchema.safeParse({
        title,
        body,
        category,
        priority,
        audiences: [{ type: 'CAMPUS' }],
        publish,
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          if (!next[key]) next[key] = issue.message;
        }
        setErrors(next);
        throw new Error(parsed.error.issues[0]?.message ?? 'Check the notice');
      }
      setErrors({});
      return apiFetch('/notices', { method: 'POST', json: parsed.data });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['notices'] });
      await hapticSuccess();
      router.back();
    },
  });

  return (
    <Screen title="New notice" subtitle="Goes to the whole campus" back keyboard>
      <TextField label="Title" value={title} onChangeText={setTitle} error={errors.title} />
      <TextField
        label="Message"
        value={body}
        onChangeText={setBody}
        error={errors.body}
        multiline
        style={styles.body}
      />
      <TextField label="Category" value={category} onChangeText={setCategory} error={errors.category} />
      <Text style={styles.label}>Priority</Text>
      <View style={styles.row}>
        {PRIORITIES.map((item) => (
          <Pressable key={item} onPress={() => setPriority(item)} style={[styles.chip, priority === item && styles.chipOn]}>
            <Text style={[styles.chipText, priority === item && styles.chipTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.publish} onPress={() => setPublish((value) => !value)}>
        <View style={[styles.box, publish && styles.boxOn]} />
        <Text style={styles.publishText}>{publish ? 'Publish now' : 'Save as draft'}</Text>
      </Pressable>
      <Text style={styles.hint}>The inbox only lists published notices. A draft stays on the server until you publish it.</Text>
      {create.isError ? <ErrorBanner message={errorText(create.error)} /> : null}
      <Button label={publish ? 'Publish notice' : 'Save draft'} loading={create.isPending} onPress={() => create.mutate()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { minHeight: 140, textAlignVertical: 'top', paddingTop: 12 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  row: { flexDirection: 'row', gap: space.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chipTextOn: { color: colors.white },
  publish: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  publishText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
});
