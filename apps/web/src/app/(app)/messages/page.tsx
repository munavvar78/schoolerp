'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Dispatch = { id: string; channel: string; recipient: string; status: string; body: string };

export default function MessagesPage() {
  const [rows, setRows] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<Dispatch[]>('/messages'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    try {
      const row = await apiFetch<Dispatch>('/messages', {
        method: 'POST',
        json: {
          channel: String(data.get('channel') || 'SMS'),
          recipient: String(data.get('recipient') || ''),
          body: String(data.get('body') || ''),
          consent: data.get('consent') === 'on',
        },
      });
      setOk(`Recorded as ${row.status}. A message is sent only when consent and a provider are both set.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the message');
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
      <Card>
        <CardHeader title="Outbound message" description="Without consent, or without provider credentials, nothing is sent." />
        <CardBody>
          <form className="grid gap-3" onSubmit={send}>
            <Select name="channel" defaultValue="SMS">
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </Select>
            <Input name="recipient" placeholder="91xxxxxxxxxx" required />
            <Textarea name="body" placeholder="Message" required />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input name="consent" type="checkbox" />
              The recipient has consented
            </label>
            <Button type="submit">Queue</Button>
          </form>
        </CardBody>
      </Card>
      {loading ? <LoadingState /> : null}
      {!loading && rows.length === 0 ? <EmptyState label="No messages yet." /> : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <CardHeader title={`${row.channel} · ${row.status}`} description={`${row.recipient} · ${row.body}`} />
        </Card>
      ))}
    </div>
  );
}
