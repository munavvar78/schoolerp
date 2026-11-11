'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Slot = { id: string; code: string; label: string; startTime: string; endTime: string };
type Subject = { id: string; name: string; code: string };
type Teacher = { id: string; name: string; email: string };
type Grade = { id: string; name: string; sections: Array<{ id: string; name: string }> };
type Session = { id: string; name: string; isCurrent: boolean };
type Entry = {
  id: string;
  dayOfWeek: number;
  periodSlotId: string;
  subjectId: string;
  teacherUserId: string;
  room?: string | null;
  periodSlot?: Slot;
  subject?: Subject;
  section?: { name: string; grade?: { name: string } };
};

const DAYS = [
  { v: 1, label: 'Mon' },
  { v: 2, label: 'Tue' },
  { v: 3, label: 'Wed' },
  { v: 4, label: 'Thu' },
  { v: 5, label: 'Fri' },
  { v: 6, label: 'Sat' },
];

type Child = {
  id: string;
  firstName: string;
  lastName?: string | null;
  enrollments?: Array<{
    sectionId: string;
    sessionId: string;
    session?: { isCurrent?: boolean };
  }>;
};

function currentEnrollment(child: Child | undefined) {
  return child?.enrollments?.find((row) => row.session?.isCurrent) ?? child?.enrollments?.[0];
}

export default function TimetablePage() {
  const role = getSession()?.role;
  const canEdit = role === 'CAMPUS_ADMIN' || role === 'ORG_OWNER';
  const family = role === 'PARENT' || role === 'STUDENT';
  const [slots, setSlots] = useState<Slot[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mine, setMine] = useState<Entry[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [periodSlotId, setPeriodSlotId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherUserId, setTeacherUserId] = useState('');
  const [room, setRoom] = useState('');
  const [draft, setDraft] = useState<
    Array<{
      dayOfWeek: number;
      periodSlotId: string;
      subjectId: string;
      teacherUserId: string;
      room?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState('');

  const sections = useMemo(() => grades.flatMap((g) => g.sections.map((s) => ({
    ...s,
    label: `${g.name}-${s.name}`,
  }))), [grades]);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (family) {
        const kids = await apiFetch<Child[]>('/students/my-children');
        setChildren(kids);
        const child = kids[0];
        if (child) setChildId(child.id);
        const enrollment = currentEnrollment(child);
        if (enrollment?.sectionId && enrollment.sessionId) {
          setMine(
            await apiFetch<Entry[]>(
              `/timetable/section?sectionId=${enrollment.sectionId}&sessionId=${enrollment.sessionId}`,
            ),
          );
        } else {
          setMine([]);
        }
        return;
      }
      const [slotList, g, s, t, subj] = await Promise.all([
        apiFetch<Slot[]>('/timetable/slots'),
        apiFetch<Grade[]>('/academic/grades'),
        apiFetch<Session[]>('/academic/sessions'),
        apiFetch<Teacher[]>('/timetable/teachers'),
        apiFetch<Subject[]>('/academic/subjects'),
      ]);
      setSlots(slotList);
      setGrades(g);
      setSessions(s);
      setTeachers(t);
      setSubjects(subj);
      const current = s.find((x) => x.isCurrent) ?? s[0];
      if (current) setSessionId(current.id);
      if (g[0]?.sections[0]) setSectionId(g[0].sections[0].id);
      if (slotList[0]) setPeriodSlotId(slotList[0].id);
      if (subj[0]) setSubjectId(subj[0].id);
      if (t[0]) setTeacherUserId(t[0].id);

      if (!canEdit) {
        const my = await apiFetch<Entry[]>(`/timetable/mine${current ? `?sessionId=${current.id}` : ''}`);
        setMine(my);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, [canEdit, family]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!canEdit || !sessionId || !sectionId) return;
    (async () => {
      try {
        const list = await apiFetch<Entry[]>(
          `/timetable/section?sectionId=${sectionId}&sessionId=${sessionId}`,
        );
        setEntries(list);
        setDraft(
          list.map((e) => ({
            dayOfWeek: e.dayOfWeek,
            periodSlotId: e.periodSlotId,
            subjectId: e.subjectId,
            teacherUserId: e.teacherUserId,
            room: e.room ?? undefined,
          })),
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load section grid');
      }
    })();
  }, [canEdit, sessionId, sectionId]);

  async function createSlot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await apiFetch('/timetable/slots', {
        method: 'POST',
        json: {
          code: String(fd.get('code') || ''),
          label: String(fd.get('label') || ''),
          sortOrder: Number(fd.get('sortOrder') || 0),
          startTime: String(fd.get('startTime') || ''),
          endTime: String(fd.get('endTime') || ''),
        },
      });
      form.reset();
      await loadMeta();
      setOk('Period slot created');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Slot create failed');
    }
  }

  function addDraftRow() {
    setDraft((prev) => [
      ...prev,
      { dayOfWeek, periodSlotId, subjectId, teacherUserId, room: room || undefined },
    ]);
  }

  async function saveGrid() {
    setOk(null);
    setError(null);
    try {
      const list = await apiFetch<Entry[]>('/timetable/grid', {
        method: 'POST',
        json: { sessionId, sectionId, entries: draft },
      });
      setEntries(list);
      setOk('Timetable saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  }

  if (loading) return <LoadingState label="Loading timetable…" />;

  async function showChild(nextId: string) {
    setChildId(nextId);
    setError(null);
    const child = children.find((row) => row.id === nextId);
    const enrollment = currentEnrollment(child);
    if (!enrollment?.sectionId || !enrollment.sessionId) {
      setMine([]);
      return;
    }
    try {
      setMine(
        await apiFetch<Entry[]>(
          `/timetable/section?sectionId=${enrollment.sectionId}&sessionId=${enrollment.sessionId}`,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load timetable');
    }
  }

  if (family) {
    const child = children.find((row) => row.id === childId) ?? children[0];
    const childName = child ? `${child.firstName} ${child.lastName ?? ''}`.trim() : 'your class';
    return (
      <div className="space-y-4">
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        <Card>
          <CardHeader title="Class timetable" description={`Periods for ${childName}`} />
          <CardBody className="space-y-3">
            {children.length > 1 ? (
              <Select label="Child" value={childId} onChange={(event) => void showChild(event.target.value)}>
                {children.map((row) => (
                  <option key={row.id} value={row.id}>
                    {`${row.firstName} ${row.lastName ?? ''}`.trim()}
                  </option>
                ))}
              </Select>
            ) : null}
            {mine.length === 0 ? (
              <EmptyState label="No periods for this class" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Day</TH>
                    <TH>Period</TH>
                    <TH>Subject</TH>
                    <TH>Room</TH>
                  </TR>
                </THead>
                <TBody>
                  {mine.map((entry) => (
                    <TR key={entry.id}>
                      <TD>{DAYS.find((day) => day.v === entry.dayOfWeek)?.label ?? entry.dayOfWeek}</TD>
                      <TD>
                        {entry.periodSlot?.label} ({entry.periodSlot?.startTime}–{entry.periodSlot?.endTime})
                      </TD>
                      <TD>{entry.subject?.name}</TD>
                      <TD>{entry.room ?? '—'}</TD>
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

  if (!canEdit) {
    return (
      <div className="space-y-4">
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        <Card>
          <CardHeader title="My periods" description="Assigned teaching slots" />
          <CardBody className="p-0">
            {mine.length === 0 ? (
              <EmptyState label="No periods assigned" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Day</TH>
                    <TH>Period</TH>
                    <TH>Subject</TH>
                    <TH>Section</TH>
                    <TH>Room</TH>
                  </TR>
                </THead>
                <TBody>
                  {mine.map((e) => (
                    <TR key={e.id}>
                      <TD>{DAYS.find((d) => d.v === e.dayOfWeek)?.label ?? e.dayOfWeek}</TD>
                      <TD>
                        {e.periodSlot?.label} ({e.periodSlot?.startTime}–{e.periodSlot?.endTime})
                      </TD>
                      <TD>{e.subject?.name}</TD>
                      <TD>
                        {e.section?.grade?.name}-{e.section?.name}
                      </TD>
                      <TD>{e.room ?? '—'}</TD>
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

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      <Card>
        <CardHeader title="Period slots" description="Campus period template" />
        <CardBody>
          <form className="grid gap-3 md:grid-cols-5" onSubmit={createSlot}>
            <Input name="code" label="Code" placeholder="P4" required />
            <Input name="label" label="Label" placeholder="Period 4" required />
            <Input name="sortOrder" label="Order" type="number" defaultValue={slots.length + 1} />
            <Input name="startTime" label="Start" placeholder="10:30" required />
            <Input name="endTime" label="End" placeholder="11:15" required />
            <Button type="submit">Add slot</Button>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Existing: {slots.map((s) => `${s.code} ${s.startTime}-${s.endTime}`).join(' · ') || 'none'}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Section grid" description="Assign day × period × subject × teacher" />
        <CardBody className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Session" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <Select
              label="Day"
              value={String(dayOfWeek)}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {DAYS.map((d) => (
                <option key={d.v} value={d.v}>
                  {d.label}
                </option>
              ))}
            </Select>
            <Select label="Period" value={periodSlotId} onChange={(e) => setPeriodSlotId(e.target.value)}>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              label="Teacher"
              value={teacherUserId}
              onChange={(e) => setTeacherUserId(e.target.value)}
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Input label="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={addDraftRow}>
              Add cell
            </Button>
            <Button type="button" onClick={() => void saveGrid()}>
              Save grid ({draft.length} cells)
            </Button>
          </div>

          {draft.length === 0 && entries.length === 0 ? (
            <EmptyState label="No timetable cells yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Day</TH>
                  <TH>Period</TH>
                  <TH>Subject</TH>
                  <TH>Teacher</TH>
                  <TH>Room</TH>
                </TR>
              </THead>
              <TBody>
                {draft.map((e, idx) => (
                  <TR key={`${e.dayOfWeek}-${e.periodSlotId}-${idx}`}>
                    <TD>{DAYS.find((d) => d.v === e.dayOfWeek)?.label}</TD>
                    <TD>{slots.find((s) => s.id === e.periodSlotId)?.label}</TD>
                    <TD>{subjects.find((s) => s.id === e.subjectId)?.name}</TD>
                    <TD>{teachers.find((t) => t.id === e.teacherUserId)?.name}</TD>
                    <TD>{e.room ?? '—'}</TD>
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
