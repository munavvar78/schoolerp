'use client';

import { FormEvent, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { ErrorAlert, SuccessAlert } from '@/components/ui/alert';

export default function ApaarPage() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    const apaarId = String(data.get('apaarId') || '');
    try {
      await apiFetch('/students/apaar', {
        method: 'POST',
        json: {
          studentId: String(data.get('studentId') || ''),
          status: String(data.get('status') || 'MISSING'),
          apaarId: apaarId || undefined,
        },
      });
      setOk('APAAR status saved. Aadhaar is not stored.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save APAAR');
    }
  }

  return (
    <Card>
      <CardHeader title="APAAR" description="Store a 12-digit APAAR ID only when the status is Issued. Do not enter Aadhaar." />
      <CardBody>
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
        <form className="grid gap-3 md:grid-cols-2" onSubmit={save}>
          <Input name="studentId" placeholder="Student id" required />
          <Select name="status" defaultValue="MISSING">
            <option value="MISSING">Missing</option>
            <option value="ISSUED">Issued</option>
            <option value="REFUSED">Refused</option>
            <option value="NOGEN">Not generated</option>
          </Select>
          <Input name="apaarId" placeholder="12-digit APAAR ID" inputMode="numeric" />
          <Button type="submit">Save</Button>
        </form>
      </CardBody>
    </Card>
  );
}
