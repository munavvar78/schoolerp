'use client';

import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ErrorAlert, SuccessAlert } from '@/components/ui/alert';

export default function PrivacyPage() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  async function request(kind: 'EXPORT' | 'ERASURE') {
    setError(null);
    setOk(null);
    try {
      const result = await apiFetch<{ request: { status: string; reason: string }; export?: { email: string; name: string } }>(
        '/privacy/requests',
        { method: 'POST', json: { kind } },
      );
      if (result.export) {
        setExported(`${result.export.name} · ${result.export.email}`);
      }
      setOk(`${kind === 'EXPORT' ? 'Export' : 'Erasure'} ${result.request.status}. ${result.request.reason}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not file the request');
    }
  }

  return (
    <Card>
      <CardHeader
        title="Your data"
        description="Export returns your profile. An erasure request stays open and does not delete fee or payroll records."
      />
      <CardBody className="space-y-3">
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
        {exported ? <p className="text-sm text-slate-700">{exported}</p> : null}
        <div className="flex gap-2">
          <Button type="button" onClick={() => void request('EXPORT')}>
            Export my data
          </Button>
          <Button type="button" onClick={() => void request('ERASURE')}>
            Request erasure
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
