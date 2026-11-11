'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FIELD_ENTITY_TYPES, FIELD_TYPES } from '@school-erp/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type TabKey =
  | 'sessions'
  | 'grades'
  | 'sections'
  | 'subjects'
  | 'statuses'
  | 'scales'
  | 'fields';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'sessions', label: 'Sessions' },
  { key: 'grades', label: 'Grades' },
  { key: 'sections', label: 'Sections' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'statuses', label: 'Attendance statuses' },
  { key: 'scales', label: 'Grade scales' },
  { key: 'fields', label: 'Field definitions' },
];

type Session = { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean };
type Grade = { id: string; name: string; sortOrder: number; sections: Array<{ id: string; name: string; capacity?: number | null }> };
type Subject = { id: string; name: string; code: string; gradeId?: string | null };
type Status = { id: string; code: string; label: string; countsAsPresent: boolean; weight: number; color?: string | null };
type GradeScale = { id: string; name: string; passPercent: number; bands: Array<{ minPercent: number; maxPercent: number; grade: string; isPass: boolean }> };
type FieldDef = {
  id: string;
  entityType: string;
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  sensitive: boolean;
};

export default function SetupPage() {
  const [tab, setTab] = useState<TabKey>('sessions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    const role = getSession()?.role;
    setCanWrite(role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, g, sub, st, sc, f] = await Promise.all([
        apiFetch<Session[]>('/academic/sessions'),
        apiFetch<Grade[]>('/academic/grades'),
        apiFetch<Subject[]>('/academic/subjects'),
        apiFetch<Status[]>('/academic/attendance-statuses'),
        apiFetch<GradeScale[]>('/academic/grade-scales'),
        apiFetch<FieldDef[]>('/academic/field-definitions'),
      ]);
      setSessions(s);
      setGrades(g);
      setSubjects(sub);
      setStatuses(st);
      setScales(sc);
      setFields(f);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load setup data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(path: string, json: unknown, success: string) {
    setOk(null);
    setError(null);
    try {
      await apiFetch(path, { method: 'POST', json });
      setOk(success);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  }

  if (loading) return <LoadingState label="Loading academic setup…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 no-print">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      {tab === 'sessions' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard title="Academic sessions">
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Start</TH>
                  <TH>End</TH>
                  <TH>Current</TH>
                </TR>
              </THead>
              <TBody>
                {sessions.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.name}</TD>
                    <TD>{String(s.startDate).slice(0, 10)}</TD>
                    <TD>{String(s.endDate).slice(0, 10)}</TD>
                    <TD>{s.isCurrent ? <Badge tone="green">Current</Badge> : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!sessions.length ? <EmptyState label="No sessions yet" /> : null}
          </ListCard>
          <FormCard hidden={!canWrite} title="Create session">
            <SessionForm onSubmit={(body) => submit('/academic/sessions', body, 'Session created')} />
          </FormCard>
        </div>
      ) : null}

      {tab === 'grades' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard title="Grades">
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Order</TH>
                  <TH>Sections</TH>
                </TR>
              </THead>
              <TBody>
                {grades.map((g) => (
                  <TR key={g.id}>
                    <TD>{g.name}</TD>
                    <TD>{g.sortOrder}</TD>
                    <TD>{g.sections?.length ?? 0}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </ListCard>
          <FormCard hidden={!canWrite} title="Create grade">
            <GradeForm onSubmit={(body) => submit('/academic/grades', body, 'Grade created')} />
          </FormCard>
        </div>
      ) : null}

      {tab === 'sections' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard title="Sections">
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Grade</TH>
                  <TH>Section</TH>
                  <TH>Capacity</TH>
                </TR>
              </THead>
              <TBody>
                {grades.flatMap((g) =>
                  (g.sections ?? []).map((sec) => (
                    <TR key={sec.id}>
                      <TD>{g.name}</TD>
                      <TD>{sec.name}</TD>
                      <TD>{sec.capacity ?? '—'}</TD>
                    </TR>
                  )),
                )}
              </TBody>
            </Table>
          </ListCard>
          <FormCard hidden={!canWrite} title="Create section">
            <SectionForm grades={grades} onSubmit={(body) => submit('/academic/sections', body, 'Section created')} />
          </FormCard>
        </div>
      ) : null}

      {tab === 'subjects' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard title="Subjects">
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Name</TH>
                </TR>
              </THead>
              <TBody>
                {subjects.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.code}</TD>
                    <TD>{s.name}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </ListCard>
          <FormCard hidden={!canWrite} title="Create subject">
            <SubjectForm grades={grades} onSubmit={(body) => submit('/academic/subjects', body, 'Subject created')} />
          </FormCard>
        </div>
      ) : null}

      {tab === 'statuses' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard title="Attendance statuses">
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Label</TH>
                  <TH>Present?</TH>
                  <TH>Weight</TH>
                </TR>
              </THead>
              <TBody>
                {statuses.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.code}</TD>
                    <TD>{s.label}</TD>
                    <TD>{s.countsAsPresent ? 'Yes' : 'No'}</TD>
                    <TD>{s.weight}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </ListCard>
          <FormCard hidden={!canWrite} title="Create status">
            <StatusForm onSubmit={(body) => submit('/academic/attendance-statuses', body, 'Status created')} />
          </FormCard>
        </div>
      ) : null}

      {tab === 'scales' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard title="Grade scales">
            {scales.map((s) => (
              <div key={s.id} className="mb-3 rounded-md border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900">{s.name}</div>
                  <Badge tone="indigo">Pass {s.passPercent}%</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {s.bands.map((b) => `${b.grade} (${b.minPercent}-${b.maxPercent})`).join(' · ')}
                </p>
              </div>
            ))}
            {!scales.length ? <EmptyState label="No grade scales" /> : null}
          </ListCard>
          <FormCard hidden={!canWrite} title="Create grade scale">
            <ScaleForm onSubmit={(body) => submit('/academic/grade-scales', body, 'Grade scale created')} />
          </FormCard>
        </div>
      ) : null}

      {tab === 'fields' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard title="Field definitions">
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Entity</TH>
                  <TH>Key</TH>
                  <TH>Label</TH>
                  <TH>Type</TH>
                </TR>
              </THead>
              <TBody>
                {fields.map((f) => (
                  <TR key={f.id}>
                    <TD>{f.entityType}</TD>
                    <TD>{f.key}</TD>
                    <TD>{f.label}</TD>
                    <TD>{f.fieldType}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </ListCard>
          <FormCard hidden={!canWrite} title="Create field definition">
            <FieldForm onSubmit={(body) => submit('/academic/field-definitions', body, 'Field created')} />
          </FormCard>
        </div>
      ) : null}
    </div>
  );
}

function ListCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function FormCard({ title, children, hidden }: { title: string; children: React.ReactNode; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <Card className="no-print">
      <CardHeader title={title} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function SessionForm({ onSubmit }: { onSubmit: (body: unknown) => Promise<void> }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);

  async function handle(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ name, startDate, endDate, isCurrent });
    setName('');
  }

  return (
    <form className="space-y-3" onSubmit={handle}>
      <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="2025-26" />
      <Input label="Start date" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      <Input label="End date" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
        Mark as current session
      </label>
      <Button type="submit">Save session</Button>
    </form>
  );
}

function GradeForm({ onSubmit }: { onSubmit: (body: unknown) => Promise<void> }) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  async function handle(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ name, sortOrder });
    setName('');
  }
  return (
    <form className="space-y-3" onSubmit={handle}>
      <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Class 6" />
      <Input
        label="Sort order"
        type="number"
        value={sortOrder}
        onChange={(e) => setSortOrder(Number(e.target.value))}
      />
      <Button type="submit">Save grade</Button>
    </form>
  );
}

function SectionForm({
  grades,
  onSubmit,
}: {
  grades: Grade[];
  onSubmit: (body: unknown) => Promise<void>;
}) {
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? '');
  const [name, setName] = useState('A');
  const [capacity, setCapacity] = useState(40);
  async function handle(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ gradeId, name, capacity });
  }
  return (
    <form className="space-y-3" onSubmit={handle}>
      <Select label="Grade" required value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
        <option value="">Select grade</option>
        {grades.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
      <Input label="Section name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Capacity" type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
      <Button type="submit">Save section</Button>
    </form>
  );
}

function SubjectForm({
  grades,
  onSubmit,
}: {
  grades: Grade[];
  onSubmit: (body: unknown) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [gradeId, setGradeId] = useState('');
  async function handle(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ name, code, ...(gradeId ? { gradeId } : {}) });
    setName('');
    setCode('');
  }
  return (
    <form className="space-y-3" onSubmit={handle}>
      <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Code" required value={code} onChange={(e) => setCode(e.target.value)} />
      <Select label="Grade (optional)" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
        <option value="">All grades</option>
        {grades.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
      <Button type="submit">Save subject</Button>
    </form>
  );
}

function StatusForm({ onSubmit }: { onSubmit: (body: unknown) => Promise<void> }) {
  const [code, setCode] = useState('P');
  const [label, setLabel] = useState('Present');
  const [countsAsPresent, setCountsAsPresent] = useState(true);
  const [weight, setWeight] = useState(1);
  const [color, setColor] = useState('#16a34a');
  async function handle(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ code, label, countsAsPresent, weight, color });
  }
  return (
    <form className="space-y-3" onSubmit={handle}>
      <Input label="Code" required value={code} onChange={(e) => setCode(e.target.value)} />
      <Input label="Label" required value={label} onChange={(e) => setLabel(e.target.value)} />
      <Input label="Weight" type="number" step="0.1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
      <Input label="Color" value={color} onChange={(e) => setColor(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={countsAsPresent} onChange={(e) => setCountsAsPresent(e.target.checked)} />
        Counts as present
      </label>
      <Button type="submit">Save status</Button>
    </form>
  );
}

function ScaleForm({ onSubmit }: { onSubmit: (body: unknown) => Promise<void> }) {
  const [name, setName] = useState('CBSE 5-point');
  const [passPercent, setPassPercent] = useState(33);
  async function handle(e: FormEvent) {
    e.preventDefault();
    await onSubmit({
      name,
      passPercent,
      bands: [
        { minPercent: 90, maxPercent: 100, grade: 'A1', isPass: true },
        { minPercent: 75, maxPercent: 89.99, grade: 'A2', isPass: true },
        { minPercent: 60, maxPercent: 74.99, grade: 'B1', isPass: true },
        { minPercent: 33, maxPercent: 59.99, grade: 'C', isPass: true },
        { minPercent: 0, maxPercent: 32.99, grade: 'E', isPass: false },
      ],
    });
  }
  return (
    <form className="space-y-3" onSubmit={handle}>
      <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        label="Pass percent"
        type="number"
        value={passPercent}
        onChange={(e) => setPassPercent(Number(e.target.value))}
      />
      <p className="text-xs text-slate-500">Creates a default CBSE-style band set (A1–E).</p>
      <Button type="submit">Save grade scale</Button>
    </form>
  );
}

function FieldForm({ onSubmit }: { onSubmit: (body: unknown) => Promise<void> }) {
  const [entityType, setEntityType] = useState<(typeof FIELD_ENTITY_TYPES)[number]>('student');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>('TEXT');
  const [required, setRequired] = useState(false);
  async function handle(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ entityType, key, label, fieldType, required, sensitive: false, sortOrder: 0 });
    setKey('');
    setLabel('');
  }
  return (
    <form className="space-y-3" onSubmit={handle}>
      <Select label="Entity" value={entityType} onChange={(e) => setEntityType(e.target.value as typeof entityType)}>
        {FIELD_ENTITY_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Input label="Key" required value={key} onChange={(e) => setKey(e.target.value)} placeholder="aadhaar_last4" />
      <Input label="Label" required value={label} onChange={(e) => setLabel(e.target.value)} />
      <Select label="Field type" value={fieldType} onChange={(e) => setFieldType(e.target.value as typeof fieldType)}>
        {FIELD_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Required
      </label>
      <Button type="submit">Save field</Button>
    </form>
  );
}
