'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Slip = {
  id: string;
  periodLabel: string;
  grossPaise: number;
  pfPaise: number;
  netPaise: number;
  staff: { user: { name: string } };
};

function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

export default function PayrollPage() {
  const [rows, setRows] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<Slip[]>('/payroll/slips'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payroll');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function compute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    try {
      await apiFetch('/payroll/slips', {
        method: 'POST',
        json: {
          staffId: String(data.get('staffId') || ''),
          periodLabel: String(data.get('periodLabel') || ''),
        },
      });
      setOk('Slip computed. No bank payout was made.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not compute the slip');
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
      <Card>
        <CardHeader title="Compute a slip" description="PF is 12% of basic, capped at ₹15,000. This does not pay the employee." />
        <CardBody>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={compute}>
            <Input name="staffId" placeholder="Staff id" required />
            <Input name="periodLabel" placeholder="2026-04" required />
            <Button type="submit">Compute</Button>
          </form>
        </CardBody>
      </Card>
      {loading ? <LoadingState /> : null}
      {!loading && rows.length === 0 ? <EmptyState label="No slips yet." /> : null}
      {rows.map((slip) => (
        <Card key={slip.id}>
          <CardHeader
            title={`${slip.staff.user.name} · ${slip.periodLabel}`}
            description={`Gross ${rupees(slip.grossPaise)} · PF ${rupees(slip.pfPaise)} · Net ${rupees(slip.netPaise)}`}
          />
        </Card>
      ))}
    </div>
  );
}
