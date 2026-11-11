'use client';

import { useCallback, useEffect, useState } from 'react';
import { MODULES, type ModuleKey } from '@school-erp/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  enabledModules: string[];
  createdAt: string;
  _count: { campuses: number; students: number; users: number };
};

export default function PlatformPage() {
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ModuleKey[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<OrganizationRow[]>('/platform/organizations');
      setRows(list);
      setDrafts(
        Object.fromEntries(
          list.map((row) => [row.id, MODULES.filter((module) => row.enabledModules.includes(module))]),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(organizationId: string, module: ModuleKey) {
    setDrafts((current) => {
      const selected = new Set(current[organizationId] ?? []);
      if (selected.has(module)) selected.delete(module);
      else selected.add(module);
      return { ...current, [organizationId]: MODULES.filter((item) => selected.has(item)) };
    });
  }

  async function save(organizationId: string) {
    setSavingId(organizationId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/platform/organizations/${organizationId}/modules`, {
        method: 'PUT',
        json: { enabledModules: drafts[organizationId] ?? [] },
      });
      setOk('Modules saved');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save modules');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <LoadingState label="Loading organizations…" />;

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
      {!rows.length ? <EmptyState label="No organizations" /> : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <CardHeader
            title={row.name}
            description={`${row.slug} · ${row._count.campuses} campuses · ${row._count.students} students · ${row._count.users} users`}
          />
          <CardBody>
            <div className="flex flex-wrap gap-3">
              {MODULES.map((module) => (
                <label key={module} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={(drafts[row.id] ?? []).includes(module)}
                    onChange={() => toggle(row.id, module)}
                  />
                  {module}
                </label>
              ))}
            </div>
            <div className="mt-4">
              <Button type="button" onClick={() => void save(row.id)} disabled={savingId === row.id}>
                {savingId === row.id ? 'Saving…' : 'Save modules'}
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
