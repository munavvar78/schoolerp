'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { canWriteTransport } from '@school-erp/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Assignment = { id: string; student: { firstName: string; lastName?: string | null } };
type Route = { id: string; name: string; capacity: number; assignments: Assignment[] };

export default function TransportPage() {
  const [rows, setRows] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    const session = getSession();
    setCanWrite(session ? canWriteTransport(session.role) : false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<Route[]>('/transport/routes'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>, path: string, json: Record<string, unknown>) {
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

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
      {canWrite ? (
      <>
      <Card>
        <CardHeader title="New route" />
        <CardBody>
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void submit(event, '/transport/routes', {
                name: String(data.get('name') || ''),
                capacity: Number(data.get('capacity') || 0),
              });
            }}
          >
            <Input name="name" placeholder="Route name" required />
            <Input name="capacity" type="number" min={1} placeholder="Seats" required />
            <Button type="submit">Save</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Assign a seat" />
        <CardBody>
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void submit(event, '/transport/assignments', {
                routeId: String(data.get('routeId') || ''),
                studentId: String(data.get('studentId') || ''),
              });
            }}
          >
            <Input name="routeId" placeholder="Route id" required />
            <Input name="studentId" placeholder="Student id" required />
            <Button type="submit">Assign</Button>
          </form>
        </CardBody>
      </Card>
      </>
      ) : null}
      {loading ? <LoadingState /> : null}
      {!loading && rows.length === 0 ? <EmptyState label="No routes yet." /> : null}
      {rows.map((route) => (
        <Card key={route.id}>
          <CardHeader title={`${route.name} · ${route.assignments.length}/${route.capacity}`} description={route.id} />
          <CardBody>
            {route.assignments.length === 0 ? 'No seats assigned.' : null}
            <ul className="text-sm text-slate-700">
              {route.assignments.map((seat) => (
                <li key={seat.id}>
                  {seat.student.firstName} {seat.student.lastName ?? ''}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
