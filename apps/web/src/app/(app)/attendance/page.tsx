'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Role } from '@school-erp/shared';
import {
  absentStatusCode,
  lateStatusCode,
  presentStatusCode,
  toIsoDate,
  validateAttendanceDate,
} from '@school-erp/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { cn, todayIsoDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

const MARK_ROLES: Role[] = ['ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER', 'TEACHER'];

type Grade = { id: string; name: string; sections: Array<{ id: string; name: string }> };
type Session = { id: string; name: string; isCurrent: boolean; startDate?: string; endDate?: string };
type Status = { code: string; label: string; countsAsPresent?: boolean; color?: string | null };
type Enrollment = {
  id: string;
  rollNo?: string | null;
  student: { firstName: string; lastName?: string | null; admissionNo: string };
};
type Grid = {
  enrollments: Enrollment[];
  day?: { locked?: boolean; marks: Array<{ enrollmentId: string; statusCode: string }> } | null;
  statuses: Status[];
};

function studentName(enrollment: Enrollment): string {
  return `${enrollment.student.firstName} ${enrollment.student.lastName ?? ''}`.trim();
}

function marksFromGrid(data: Grid, presentCode: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const enrollment of data.enrollments) {
    const existing = data.day?.marks.find((mark) => mark.enrollmentId === enrollment.id);
    next[enrollment.id] = existing?.statusCode ?? presentCode;
  }
  return next;
}

export default function AttendancePage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [grid, setGrid] = useState<Grid | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [savedMarks, setSavedMarks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'all' | 'absent' | 'not-present'>('all');
  const [canMark, setCanMark] = useState(false);
  const [family, setFamily] = useState(false);
  const [familyClassLabel, setFamilyClassLabel] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const sections = useMemo(
    () => grades.flatMap((grade) => (grade.sections ?? []).map((section) => ({ id: section.id, label: `${grade.name} · ${section.name}` }))),
    [grades],
  );

  const presentCode = presentStatusCode(grid?.statuses ?? []) ?? 'PRESENT';
  const absentCode = absentStatusCode(grid?.statuses ?? []);
  const lateCode = lateStatusCode(grid?.statuses ?? []);
  const otherStatuses = (grid?.statuses ?? []).filter(
    (status) => status.code !== presentCode && status.code !== absentCode && status.code !== lateCode,
  );
  const locked = Boolean(grid?.day?.locked);

  useEffect(() => {
    const role = getSession()?.role;
    const isFamily = role === 'PARENT' || role === 'STUDENT';
    setFamily(isFamily);
    setCanMark(role ? MARK_ROLES.includes(role) : false);
    (async () => {
      try {
        if (isFamily) {
          const kids = await apiFetch<Array<{
            firstName: string;
            lastName?: string | null;
            enrollments?: Array<{
              sectionId: string;
              sessionId: string;
              section?: { name: string; grade?: { name: string } };
              session?: { id: string; name: string; isCurrent?: boolean; startDate?: string; endDate?: string };
            }>;
          }>>('/students/my-children');
          const child = kids[0];
          const enrollment = child?.enrollments?.find((row) => row.session?.isCurrent) ?? child?.enrollments?.[0];
          if (enrollment?.sectionId) setSectionId(enrollment.sectionId);
          if (enrollment?.sessionId) setSessionId(enrollment.sessionId);
          if (enrollment?.session) {
            setSessions([{ ...enrollment.session, isCurrent: Boolean(enrollment.session.isCurrent) }]);
          }
          const gradeName = enrollment?.section?.grade?.name;
          const sectionName = enrollment?.section?.name;
          const who = child ? `${child.firstName} ${child.lastName ?? ''}`.trim() : 'Linked student';
          setFamilyClassLabel([who, gradeName, sectionName].filter(Boolean).join(' · '));
          return;
        }
        const [gradeRows, sessionRows] = await Promise.all([
          apiFetch<Grade[]>('/academic/grades'),
          apiFetch<Session[]>('/academic/sessions'),
        ]);
        setGrades(gradeRows);
        setSessions(sessionRows);
        const current = sessionRows.find((session) => session.isCurrent) ?? sessionRows[0];
        if (current) setSessionId(current.id);
        const firstSection = gradeRows[0]?.sections?.[0];
        if (firstSection) setSectionId(firstSection.id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load filters');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, []);

  const applyGrid = useCallback((data: Grid) => {
    const present = presentStatusCode(data.statuses) ?? 'PRESENT';
    const next = marksFromGrid(data, present);
    setGrid(data);
    setMarks(next);
    setSavedMarks(next);
  }, []);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) ?? null,
    [sessionId, sessions],
  );

  const dateRule = useMemo(() => {
    if (!date) return { ok: false as const, message: 'Choose a date' };
    return validateAttendanceDate(
      date,
      selectedSession?.startDate && selectedSession?.endDate
        ? { startDate: selectedSession.startDate, endDate: selectedSession.endDate }
        : null,
    );
  }, [date, selectedSession]);

  const editable = canMark && !locked && !saving && dateRule.ok;

  const loadGrid = useCallback(async () => {
    if (!sectionId || !sessionId || !date) return;
    if (!dateRule.ok) {
      setError(dateRule.message);
      setGrid(null);
      setMarks({});
      setSavedMarks({});
      return;
    }
    const seq = ++loadSeq.current;
    setLoadingGrid(true);
    setError(null);
    setOk(null);
    setGrid(null);
    try {
      const params = new URLSearchParams({ sectionId, sessionId, date });
      const data = await apiFetch<Grid>(`/attendance/grid?${params}`);
      if (seq !== loadSeq.current) return;
      applyGrid(data);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err instanceof ApiError ? err.message : 'Failed to load attendance');
      setGrid(null);
    } finally {
      if (seq === loadSeq.current) setLoadingGrid(false);
    }
  }, [applyGrid, date, dateRule, sectionId, sessionId]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let other = 0;
    for (const enrollment of grid?.enrollments ?? []) {
      const code = marks[enrollment.id] ?? presentCode;
      if (absentCode && code === absentCode) absent += 1;
      else if (lateCode && code === lateCode) late += 1;
      else if (code === presentCode) present += 1;
      else other += 1;
    }
    return { present, absent, late, other, total: grid?.enrollments.length ?? 0 };
  }, [absentCode, grid?.enrollments, lateCode, marks, presentCode]);

  const dirty = useMemo(() => {
    const ids = grid?.enrollments.map((enrollment) => enrollment.id) ?? [];
    return ids.some((id) => (marks[id] ?? '') !== (savedMarks[id] ?? ''));
  }, [grid?.enrollments, marks, savedMarks]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (grid?.enrollments ?? []).filter((enrollment) => {
      const code = marks[enrollment.id] ?? presentCode;
      if (rosterFilter === 'absent' && code !== absentCode) return false;
      if (rosterFilter === 'not-present' && code === presentCode) return false;
      if (!needle) return true;
      const haystack = `${studentName(enrollment)} ${enrollment.rollNo ?? ''} ${enrollment.student.admissionNo}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [absentCode, grid?.enrollments, marks, presentCode, query, rosterFilter]);

  function setStatus(enrollmentId: string, statusCode: string) {
    if (!editable) return;
    setMarks((prev) => ({ ...prev, [enrollmentId]: statusCode }));
    setOk(null);
  }

  function toggleAbsent(enrollmentId: string) {
    if (!absentCode) return;
    const current = marks[enrollmentId] ?? presentCode;
    setStatus(enrollmentId, current === absentCode ? presentCode : absentCode);
  }

  function toggleLate(enrollmentId: string) {
    if (!lateCode) return;
    const current = marks[enrollmentId] ?? presentCode;
    setStatus(enrollmentId, current === lateCode ? presentCode : lateCode);
  }

  async function save() {
    if (!dateRule.ok) {
      setError(dateRule.message);
      return;
    }
    if (!grid || !canMark || locked || saving) return;
    setSaving(true);
    setError(null);
    setOk(null);
    const payloadMarks = grid.enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      statusCode: marks[enrollment.id] ?? presentCode,
    }));
    try {
      const data = await apiFetch<Grid>('/attendance/mark', {
        method: 'POST',
        json: { sectionId, sessionId, date, marks: payloadMarks },
      });
      applyGrid(data);
      const savedAbsent = payloadMarks.filter((mark) => mark.statusCode === absentCode).length;
      const savedPresent = payloadMarks.filter((mark) => mark.statusCode === presentCode).length;
      const savedLate = lateCode ? payloadMarks.filter((mark) => mark.statusCode === lateCode).length : 0;
      const lateBit = savedLate ? ` · ${savedLate} late` : '';
      setOk(`Attendance saved · ${savedPresent} present · ${savedAbsent} absent${lateBit}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loadingMeta) return <LoadingState label="Loading attendance…" />;

  const sectionLabel = sections.find((section) => section.id === sectionId)?.label ?? 'Class';
  const waiting = Boolean(sectionId && sessionId && date && dateRule.ok) && !grid && !error;
  const maxAttendanceDate = todayIsoDate();
  const minAttendanceDate = selectedSession?.startDate
    ? toIsoDate(selectedSession.startDate)
    : undefined;

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      <Card className="no-print">
        <CardHeader
          title={family ? 'Attendance' : 'Class attendance'}
          description={
            family
              ? 'Marks for the linked student. Other students in the class stay hidden.'
              : 'Everyone starts present. Tap only the students who are absent, then save the class. Future dates are not allowed.'
          }
        />
        <CardBody className="grid gap-3 md:grid-cols-3">
          {family ? (
            <Input label="Student" value={familyClassLabel || 'No linked class'} readOnly />
          ) : (
          <Select
            label="Class"
            value={sectionId}
            disabled={saving}
            onChange={(event) => {
              setSectionId(event.target.value);
              setQuery('');
              setRosterFilter('all');
            }}
          >
            <option value="">Select class</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </Select>
          )}
          <Select label="Session" value={sessionId} disabled={saving || family} onChange={(event) => setSessionId(event.target.value)}>
            <option value="">Select session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </Select>
          <Input
            label="Date"
            type="date"
            value={date}
            min={minAttendanceDate}
            max={maxAttendanceDate}
            disabled={saving}
            error={!dateRule.ok ? dateRule.message : undefined}
            onChange={(event) => setDate(event.target.value)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={sectionId ? sectionLabel : 'Roster'}
          description={date}
          actions={
            grid ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="green">{counts.present} present</Badge>
                <Badge tone="rose">{counts.absent} absent</Badge>
                {lateCode ? <Badge tone="amber">{counts.late} late</Badge> : null}
                {counts.other ? <Badge>{counts.other} other</Badge> : null}
              </div>
            ) : null
          }
        />
        <CardBody className="space-y-3 p-0">
          {!canMark ? (
            <p className="px-4 pt-3 text-sm text-slate-500">You can review this class. Only teachers and admins can save attendance.</p>
          ) : null}
          {locked ? (
            <p className="px-4 pt-3 text-sm text-amber-800">This day is locked, so marks cannot be changed.</p>
          ) : null}

          {grid ? (
            <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Input
                  label="Find a student"
                  placeholder="Name, roll, or admission no"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 pb-0.5">
                {(
                  [
                    ['all', 'All'],
                    ['absent', 'Absent'],
                    ['not-present', 'Not present'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={rosterFilter === key ? 'secondary' : 'outline'}
                    onClick={() => setRosterFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {loadingGrid || waiting ? <LoadingState label="Loading class…" /> : null}
          {!loadingGrid && !waiting && !grid && !sectionId ? <EmptyState label="No class sections yet" /> : null}
          {grid && !grid.enrollments.length ? <EmptyState label="No students in this class" /> : null}

          {grid && grid.enrollments.length ? (
            <ul className="max-h-[min(62vh,680px)] divide-y divide-slate-100 overflow-y-auto border-y border-slate-100">
              {visible.map((enrollment) => {
                const code = marks[enrollment.id] ?? presentCode;
                const isAbsent = Boolean(absentCode && code === absentCode);
                const isLate = Boolean(lateCode && code === lateCode);
                const status = grid.statuses.find((item) => item.code === code);
                const label = status?.label ?? code;
                return (
                  <li
                    key={enrollment.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5',
                      isAbsent && 'bg-rose-50',
                      isLate && 'bg-amber-50',
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/70 disabled:cursor-default"
                      onClick={() => toggleAbsent(enrollment.id)}
                      disabled={!editable || !absentCode}
                      aria-pressed={isAbsent}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold',
                          isAbsent ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300 bg-white text-transparent',
                        )}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="w-8 shrink-0 text-sm font-semibold tabular-nums text-slate-500">
                        {enrollment.rollNo ?? '—'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{studentName(enrollment)}</span>
                        <span className="block truncate text-xs text-slate-500">{enrollment.student.admissionNo}</span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-xs font-semibold uppercase tracking-wide',
                          isAbsent ? 'text-rose-700' : isLate ? 'text-amber-800' : 'text-emerald-700',
                        )}
                      >
                        {label}
                      </span>
                    </button>
                    {lateCode ? (
                      <Button
                        size="sm"
                        variant={isLate ? 'secondary' : 'outline'}
                        disabled={!editable}
                        onClick={() => toggleLate(enrollment.id)}
                      >
                        Late
                      </Button>
                    ) : null}
                    {otherStatuses.length ? (
                      <select
                        aria-label={`Other status for ${studentName(enrollment)}`}
                        className="h-8 max-w-[8.5rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800"
                        disabled={!editable}
                        value={otherStatuses.some((status) => status.code === code) ? code : ''}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (next) setStatus(enrollment.id, next);
                        }}
                      >
                        <option value="">Other</option>
                        {otherStatuses.map((status) => (
                          <option key={status.code} value={status.code}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </li>
                );
              })}
              {!visible.length ? (
                <li>
                  <EmptyState label="No students match that search" />
                </li>
              ) : null}
            </ul>
          ) : null}

          {grid && grid.enrollments.length ? (
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{counts.absent} absent</span>
                {' · '}
                {counts.present} present
                {lateCode ? ` · ${counts.late} late` : ''}
                {counts.other ? ` · ${counts.other} other` : ''}
                {' · '}
                {counts.total} in class
                {dirty ? ' · unsaved' : ''}
              </p>
              <Button size="lg" onClick={() => void save()} disabled={!editable || loadingGrid}>
                {saving ? 'Saving…' : 'Save attendance'}
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
