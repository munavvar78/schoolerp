import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import { Button, Card, EmptyState, ErrorBanner, Screen, SkeletonList, SuccessBanner, TextField } from '../components/ui';
import { colors, fonts } from '../theme';

type Field = { key: string; label: string; numeric?: boolean };

function payload(fields: Field[], values: Record<string, string>) {
  const json: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.key]?.trim() ?? '';
    if (!raw) continue;
    json[field.key] = field.numeric ? Number(raw) : raw;
  }
  return json;
}

export function OpsFormScreen(props: {
  title: string;
  subtitle: string;
  queryKey: string;
  listPath: string;
  createPath?: string;
  fields?: Field[];
  second?: { title: string; path: string; fields: Field[] };
  extra?: { title: string; pathPrefix: string; idKey: string; pathSuffix: string; label: string };
  actions?: {
    title: string;
    listPath: string;
    summarize: (row: Record<string, unknown>) => string;
    pending: (row: Record<string, unknown>) => boolean;
    approvePath: (id: string) => string;
    rejectPath: (id: string) => string;
  };
  summarize: (row: Record<string, unknown>) => string;
  canWrite?: boolean;
}) {
  const client = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [secondValues, setSecondValues] = useState<Record<string, string>>({});
  const [extraId, setExtraId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: [props.queryKey],
    queryFn: () => apiFetch<Record<string, unknown>[]>(props.listPath),
  });
  const decisions = useQuery({
    queryKey: ['ops-actions', props.actions?.listPath],
    enabled: Boolean(props.actions),
    queryFn: () => apiFetch<Record<string, unknown>[]>(props.actions?.listPath ?? props.listPath),
  });
  const save = useMutation({
    mutationFn: () => apiFetch(props.createPath ?? props.listPath, { method: 'POST', json: payload(props.fields ?? [], values) }),
    onSuccess: async () => {
      setMessage('Saved');
      setFormError(null);
      await client.invalidateQueries({ queryKey: [props.queryKey] });
    },
    onError: (error) => setFormError(errorText(error)),
  });
  const saveSecond = useMutation({
    mutationFn: () => {
      if (!props.second) throw new Error('Missing form');
      return apiFetch(props.second.path, { method: 'POST', json: payload(props.second.fields, secondValues) });
    },
    onSuccess: async () => {
      setMessage('Saved');
      setFormError(null);
      await client.invalidateQueries({ queryKey: [props.queryKey] });
      await client.invalidateQueries({ queryKey: ['ops-actions', props.actions?.listPath] });
    },
    onError: (error) => setFormError(errorText(error)),
  });
  const saveExtra = useMutation({
    mutationFn: () => {
      if (!props.extra) throw new Error('Missing form');
      return apiFetch(`${props.extra.pathPrefix}${extraId.trim()}${props.extra.pathSuffix}`, { method: 'POST' });
    },
    onSuccess: async () => {
      setMessage('Saved');
      setFormError(null);
      await client.invalidateQueries({ queryKey: [props.queryKey] });
    },
    onError: (error) => setFormError(errorText(error)),
  });
  const decide = useMutation({
    mutationFn: (path: string) => apiFetch(path, { method: 'POST' }),
    onSuccess: async () => {
      setMessage('Saved');
      setFormError(null);
      await client.invalidateQueries({ queryKey: ['ops-actions', props.actions?.listPath] });
      await client.invalidateQueries({ queryKey: [props.queryKey] });
    },
    onError: (error) => setFormError(errorText(error)),
  });

  return (
    <Screen title={props.title} subtitle={props.subtitle}>
      {query.isLoading ? <SkeletonList /> : null}
      {query.isError ? <ErrorBanner message={errorText(query.error)} /> : null}
      {message ? <SuccessBanner message={message} /> : null}
      {formError ? <ErrorBanner message={formError} /> : null}
      {props.canWrite !== false && props.fields && props.createPath ? (
        <Card>
          {props.fields.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              keyboardType={field.numeric ? 'number-pad' : 'default'}
              onChangeText={(text) => setValues((current) => ({ ...current, [field.key]: text }))}
            />
          ))}
          <Button label="Save" loading={save.isPending} onPress={() => save.mutate()} />
        </Card>
      ) : null}
      {props.canWrite !== false && props.second ? (
        <Card>
          <Text style={styles.line}>{props.second.title}</Text>
          {props.second.fields.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              value={secondValues[field.key] ?? ''}
              keyboardType={field.numeric ? 'number-pad' : 'default'}
              onChangeText={(text) => setSecondValues((current) => ({ ...current, [field.key]: text }))}
            />
          ))}
          <Button label="Save" loading={saveSecond.isPending} onPress={() => saveSecond.mutate()} />
        </Card>
      ) : null}
      {props.canWrite !== false && props.extra ? (
        <Card>
          <Text style={styles.line}>{props.extra.title}</Text>
          <TextField label={props.extra.label} value={extraId} onChangeText={setExtraId} />
          <Button label="Save" loading={saveExtra.isPending} onPress={() => saveExtra.mutate()} />
        </Card>
      ) : null}
      {(query.data ?? []).length === 0 && !query.isLoading ? <EmptyState title="Nothing here yet." /> : null}
      {(query.data ?? []).map((row) => (
        <Card key={String(row.id)}>
          <Text style={styles.line}>{props.summarize(row)}</Text>
        </Card>
      ))}
      {props.canWrite !== false && props.actions ? (
        <>
          <Text style={styles.line}>{props.actions.title}</Text>
          {(decisions.data ?? []).map((row) => {
            const actions = props.actions;
            if (!actions) return null;
            return (
              <Card key={String(row.id)}>
                <Text style={styles.line}>{actions.summarize(row)}</Text>
                {actions.pending(row) ? (
                  <>
                    <Button
                      label="Approve"
                      loading={decide.isPending}
                      onPress={() => decide.mutate(actions.approvePath(String(row.id)))}
                    />
                    <Button
                      label="Reject"
                      variant="secondary"
                      loading={decide.isPending}
                      onPress={() => decide.mutate(actions.rejectPath(String(row.id)))}
                    />
                  </>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { color: colors.ink, fontFamily: fonts.regular, fontSize: 14 },
});
