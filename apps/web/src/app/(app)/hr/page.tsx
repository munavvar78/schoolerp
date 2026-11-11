'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Staff = {
  id: string;
  employeeCode: string;
  leaveBalance: number;
  user: { name: string };
};
type Leave = { id: string; days: number; status: string; staff: { user: { name: string } } };

export default function HrPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [people, requests] = await Promise.all([
        apiFetch<Staff[]>('/hr/staff'),
        apiFetch<Leave[]>('/hr/leave'),
      ]);
      setStaff(people);
      setLeave(requests);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load HR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(event: FormEvent<HTMLFormElement>, path: string, json: Record<string, unknown>) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch(path, { method: 'POST', json });
      setOk('Saved');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  async function decide(id: string, approve: boolean) {
    setError(null);
    try {
      await apiFetch(`/hr/leave/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' });
      setOk(approve ? 'Leave approved' : 'Leave rejected');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update leave');
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
      <Card>
        <CardHeader title="Staff profile" description="Pay is stored in paise. A slip is computed later and is not paid out." />
        <CardBody>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void post(event, '/hr/staff', {
                userId: String(data.get('userId') || ''),
                employeeCode: String(data.get('employeeCode') || ''),
                basicPaise: Number(data.get('basicPaise') || 0),
                hraPaise: Number(data.get('hraPaise') || 0),
              });
            }}
          >
            <Input name="userId" placeholder="User id" required />
            <Input name="employeeCode" placeholder="Employee code" required />
            <Input name="basicPaise" type="number" min={0} placeholder="Basic paise" required />
            <Input name="hraPaise" type="number" min={0} placeholder="HRA paise" />
            <Button type="submit">Save</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Leave request" />
        <CardBody>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void post(event, '/hr/leave', {
                staffId: String(data.get('staffId') || ''),
                days: Number(data.get('days') || 0),
                startDate: String(data.get('startDate') || ''),
              });
            }}
          >
            <Input name="staffId" placeholder="Staff id" required />
            <Input name="days" type="number" min={1} placeholder="Days" required />
            <Input name="startDate" type="date" required />
            <Button type="submit">Request</Button>
          </form>
        </CardBody>
      </Card>
      {loading ? <LoadingState /> : null}
      {!loading && staff.length === 0 ? <EmptyState label="No staff profiles yet." /> : null}
      {staff.map((person) => (
        <Card key={person.id}>
          <CardHeader
            title={`${person.user.name} · ${person.employeeCode}`}
            description={`${person.leaveBalance} leave days · ${person.id}`}
          />
        </Card>
      ))}
      {leave.map((row) => (
        <Card key={row.id}>
          <CardHeader title={`${row.staff.user.name} · ${row.days} days · ${row.status}`} />
          {row.status === 'PENDING' ? (
            <CardBody className="flex gap-2">
              <Button type="button" onClick={() => void decide(row.id, true)}>
                Approve
              </Button>
              <Button type="button" onClick={() => void decide(row.id, false)}>
                Reject
              </Button>
            </CardBody>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
