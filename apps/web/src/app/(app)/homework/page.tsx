'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { sessionCanTeach } from '@/lib/write-roles';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Grade = { id: string; name: string; sections: Array<{ id: string; name: string }> };
type Session = { id: string; name: string; isCurrent: boolean };
type Subject = { id: string; name: string };
type Homework = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  subject?: { name: string };
  section?: { name: string; grade?: { name: string } };
  completions?: Array<{ id: string; enrollmentId: string; status: string }>;
};

export default function HomeworkPage() {
  const [items, setItems] = useState<Homework[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);

  const sections = useMemo(
    () =>
      grades.flatMap((g) =>
        g.sections.map((s) => ({ id: s.id, label: `${g.name}-${s.name}` })),
      ),
    [grades],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const writer = sessionCanTeach();
    setCanWrite(writer);
    try {
      if (!writer) {
        setItems(await apiFetch<Homework[]>('/homework'));
        return;
      }
      const [list, g, s, subj] = await Promise.all([
        apiFetch<Homework[]>('/homework'),
        apiFetch<Grade[]>('/academic/grades'),
        apiFetch<Session[]>('/academic/sessions'),
        apiFetch<Subject[]>('/academic/subjects'),
      ]);
      setItems(list);
      setGrades(g);
      setSessions(s);
      setSubjects(subj);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load homework');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createHomework(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await apiFetch('/homework', {
        method: 'POST',
        json: {
          sessionId: String(fd.get('sessionId') || ''),
          sectionId: String(fd.get('sectionId') || ''),
          subjectId: String(fd.get('subjectId') || ''),
          title: String(fd.get('title') || ''),
          description: String(fd.get('description') || '') || undefined,
          dueDate: String(fd.get('dueDate') || ''),
          attachmentUrl: String(fd.get('attachmentUrl') || '') || undefined,
        },
      });
      form.reset();
      await load();
      setOk('Homework assigned');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  }

  async function markChecked(homeworkId: string, enrollmentId: string) {
    setOk(null);
    setError(null);
    try {
      await apiFetch('/homework/completion', {
        method: 'POST',
        json: { homeworkId, enrollmentId, status: 'CHECKED' },
      });
      setOk('Marked checked');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  const currentSession = sessions.find((s) => s.isCurrent) ?? sessions[0];

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      {canWrite ? (
      <Card>
        <CardHeader title="Assign homework" description="URL attachments only in Phase 2" />
        <CardBody>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={createHomework}>
            <Select name="sessionId" label="Session" required defaultValue={currentSession?.id}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select name="sectionId" label="Section" required>
              <option value="">Select</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select name="subjectId" label="Subject" required>
              <option value="">Select</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input name="title" label="Title" required />
            <Input name="dueDate" label="Due date" type="date" required />
            <Input name="attachmentUrl" label="Attachment URL" type="url" />
            <div className="md:col-span-3">
              <Textarea name="description" label="Description" rows={3} />
            </div>
            <div>
              <Button type="submit">Assign</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      ) : null}

      <Card>
        <CardHeader title="Homework" description={`${items.length} assignments`} />
        <CardBody className="p-0">
          {loading ? (
            <LoadingState label="Loading…" />
          ) : items.length === 0 ? (
            <EmptyState label="No homework yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Class</TH>
                  <TH>Subject</TH>
                  <TH>Due</TH>
                  <TH>Completions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((hw) => (
                  <TR key={hw.id}>
                    <TD>
                      <div className="font-medium">{hw.title}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{hw.description}</div>
                    </TD>
                    <TD>
                      {hw.section?.grade?.name}-{hw.section?.name}
                    </TD>
                    <TD>{hw.subject?.name}</TD>
                    <TD>{String(hw.dueDate).slice(0, 10)}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {(hw.completions ?? []).slice(0, 5).map((c) =>
                          canWrite ? (
                          <Button
                            key={c.id}
                            type="button"
                            variant="outline"
                            onClick={() => void markChecked(hw.id, c.enrollmentId)}
                          >
                            <Badge>{c.status}</Badge>
                          </Button>
                          ) : (
                            <Badge key={c.id}>{c.status}</Badge>
                          ),
                        )}
                        {(hw.completions?.length ?? 0) > 5 ? (
                          <span className="text-xs text-slate-500">
                            +{(hw.completions?.length ?? 0) - 5} more
                          </span>
                        ) : null}
                      </div>
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
