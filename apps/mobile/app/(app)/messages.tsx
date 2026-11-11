import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../src/api/client';
import { errorText } from '../../src/api/errors';
import { Button, Card, EmptyState, ErrorBanner, Screen, SuccessBanner, TextField } from '../../src/components/ui';
import { colors, fonts } from '../../src/theme';

type Dispatch = { id: string; channel: string; recipient: string; status: string; body: string };

export default function MessagesRoute() {
  const client = useQueryClient();
  const [recipient, setRecipient] = useState('');
  const [body, setBody] = useState('');
  const [consent, setConsent] = useState(false);
  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('SMS');
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['messages'],
    queryFn: () => apiFetch<Dispatch[]>('/messages'),
  });
  const send = useMutation({
    mutationFn: () =>
      apiFetch<Dispatch>('/messages', {
        method: 'POST',
        json: { channel, recipient, body, consent },
      }),
    onSuccess: async (row) => {
      setMessage(`Recorded as ${row.status}`);
      setFormError(null);
      await client.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error) => setFormError(errorText(error)),
  });

  return (
    <Screen title="Messages" subtitle="Nothing is sent without consent and a configured provider">
      {message ? <SuccessBanner message={message} /> : null}
      {formError ? <ErrorBanner message={formError} /> : null}
      <Card>
        <TextField label="Phone" value={recipient} onChangeText={setRecipient} keyboardType="phone-pad" />
        <TextField label="Message" value={body} onChangeText={setBody} />
        <Button
          label={channel === 'SMS' ? 'Channel: SMS' : 'Channel: WhatsApp'}
          variant="secondary"
          onPress={() => setChannel((current) => (current === 'SMS' ? 'WHATSAPP' : 'SMS'))}
        />
        <Button label={consent ? 'Consent recorded' : 'Mark consent'} variant="secondary" onPress={() => setConsent((value) => !value)} />
        <Button label={channel === 'SMS' ? 'Queue SMS' : 'Queue WhatsApp'} loading={send.isPending} onPress={() => send.mutate()} />
      </Card>
      {(query.data ?? []).length === 0 ? <EmptyState title="No messages yet." /> : null}
      {(query.data ?? []).map((row) => (
        <Card key={row.id}>
          <Text style={styles.line}>{`${row.channel} · ${row.status} · ${row.recipient}`}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { color: colors.ink, fontFamily: fonts.regular, fontSize: 14 },
});
