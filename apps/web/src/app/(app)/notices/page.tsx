'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { sessionCanTeach } from '@/lib/write-roles';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Notice = {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  publishedAt?: string | null;
  audiences?: Array<{ type: string; role?: string | null }>;
};

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const writer = sessionCanTeach();
    const role = getSession()?.role;
    setCanWrite(writer);
    try {
      const list = await apiFetch<Notice[]>(writer || role === 'PLATFORM_OPERATOR' ? '/notices' : '/notices/inbox');
      setNotices(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createNotice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const audienceType = String(fd.get('audienceType') || 'CAMPUS');
    const title = String(fd.get('title') || '');
    try {
      await apiFetch('/notices', {
        method: 'POST',
        json: {
          title,
          body: String(fd.get('body') || ''),
          category: String(fd.get('category') || 'Academic'),
          priority: String(fd.get('priority') || 'NORMAL'),
          publish: fd.get('publish') === 'on',
          audiences:
            audienceType === 'ROLE'
              ? [{ type: 'ROLE', role: String(fd.get('role') || 'PARENT') }]
              : [{ type: 'CAMPUS' }],
        },
      });
      form.reset();
      await load();
      setOk(`Notice saved: ${title}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  }

  async function publish(id: string) {
    setOk(null);
    setError(null);
    try {
      await apiFetch('/notices/publish', { method: 'POST', json: { noticeId: id } });
      setOk('Notice published');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Publish failed');
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      {canWrite ? (
      <Card>
        <CardHeader title="Compose circular / notice" description="In-app only — WhatsApp/SMS is Phase 5" />
        <CardBody>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createNotice}>
            <Input name="title" label="Title" required />
            <Select name="category" label="Category" defaultValue="Academic">
              <option value="Academic">Academic</option>
              <option value="Fee">Fee</option>
              <option value="Holiday">Holiday</option>
              <option value="Urgent">Urgent</option>
            </Select>
            <Select name="priority" label="Priority" defaultValue="NORMAL">
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
            <Select name="audienceType" label="Audience" defaultValue="CAMPUS">
              <option value="CAMPUS">Whole campus</option>
              <option value="ROLE">By role</option>
            </Select>
            <Select name="role" label="Role (if by role)" defaultValue="PARENT">
              <option value="PARENT">Parent</option>
              <option value="TEACHER">Teacher</option>
              <option value="STUDENT">Student</option>
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" name="publish" defaultChecked />
              Publish immediately
            </label>
            <div className="md:col-span-2">
              <Textarea name="body" label="Body" required rows={4} />
            </div>
            <div>
              <Button type="submit">Save notice</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      ) : null}

      <Card>
        <CardHeader title="Notices" description={`${notices.length} total`} />
        <CardBody className="p-0">
          {loading ? (
            <LoadingState label="Loading notices…" />
          ) : notices.length === 0 ? (
            <EmptyState label="No notices yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Category</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {notices.map((n) => (
                  <TR key={n.id}>
                    <TD>
                      <div className="font-medium">{n.title}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{n.body}</div>
                    </TD>
                    <TD>{n.category}</TD>
                    <TD>
                      <Badge tone={n.priority === 'URGENT' ? 'rose' : 'indigo'}>{n.priority}</Badge>
                    </TD>
                    <TD>{n.publishedAt ? 'Published' : 'Draft'}</TD>
                    <TD>
                      {canWrite && !n.publishedAt ? (
                        <Button type="button" variant="outline" onClick={() => void publish(n.id)}>
                          Publish
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
