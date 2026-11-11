'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Item = { id: string; sku: string; name: string; onHand: number };

export default function InventoryPage() {
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<Item[]>('/inventory/items'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load inventory');
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
        <CardHeader title="New item" />
        <CardBody>
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void post(event, '/inventory/items', {
                sku: String(data.get('sku') || ''),
                name: String(data.get('name') || ''),
              });
            }}
          >
            <Input name="sku" placeholder="SKU" required />
            <Input name="name" placeholder="Name" required />
            <Button type="submit">Save</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Stock movement" description="Use a negative quantity to issue stock." />
        <CardBody>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void post(event, '/inventory/movements', {
                itemId: String(data.get('itemId') || ''),
                quantityDelta: Number(data.get('quantityDelta') || 0),
                reason: String(data.get('reason') || ''),
              });
            }}
          >
            <Input name="itemId" placeholder="Item id" required />
            <Input name="quantityDelta" type="number" placeholder="Quantity" required />
            <Input name="reason" placeholder="Reason" required />
            <Button type="submit">Apply</Button>
          </form>
        </CardBody>
      </Card>
      {loading ? <LoadingState /> : null}
      {!loading && rows.length === 0 ? <EmptyState label="No stock items yet." /> : null}
      {rows.map((item) => (
        <Card key={item.id}>
          <CardHeader title={`${item.name} · ${item.onHand} on hand`} description={`${item.sku} · ${item.id}`} />
        </Card>
      ))}
    </div>
  );
}
