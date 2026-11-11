'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Room = { id: string; name: string; beds: number; allocations: Array<{ id: string }> };

export default function HostelPage() {
  const [rows, setRows] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<Room[]>('/hostel/rooms'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load hostel rooms');
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

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
      <Card>
        <CardHeader title="New room" />
        <CardBody>
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void post(event, '/hostel/rooms', {
                name: String(data.get('name') || ''),
                beds: Number(data.get('beds') || 0),
              });
            }}
          >
            <Input name="name" placeholder="Room" required />
            <Input name="beds" type="number" min={1} placeholder="Beds" required />
            <Button type="submit">Save</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Allocate a bed" />
        <CardBody>
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void post(event, '/hostel/allocations', {
                roomId: String(data.get('roomId') || ''),
                studentId: String(data.get('studentId') || ''),
              });
            }}
          >
            <Input name="roomId" placeholder="Room id" required />
            <Input name="studentId" placeholder="Student id" required />
            <Button type="submit">Allocate</Button>
          </form>
        </CardBody>
      </Card>
      {loading ? <LoadingState /> : null}
      {!loading && rows.length === 0 ? <EmptyState label="No rooms yet." /> : null}
      {rows.map((room) => (
        <Card key={room.id}>
          <CardHeader title={`${room.name} · ${room.allocations.length}/${room.beds}`} description={room.id} />
        </Card>
      ))}
    </div>
  );
}
