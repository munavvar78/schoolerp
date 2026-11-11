'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { parseBulkStudentCsv } from '@school-erp/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { getAccessToken, getSession } from '@/lib/session';
import { todayIsoDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Student = {
  id: string;
  firstName: string;
  lastName?: string | null;
  admissionNo: string;
  gender?: string | null;
  enrollments?: Array<{
    id: string;
    rollNo?: string | null;
    section?: { name: string; grade?: { name: string } };
    session?: { name: string };
  }>;
};

type Grade = { id: string; name: string; sections: Array<{ id: string; name: string }> };
type Session = { id: string; name: string; isCurrent: boolean };

type BulkResult = {
  createdCount: number;
  failedCount: number;
  created: Array<{ id: string; admissionNo: string; enrolled: boolean }>;
  errors: Array<{ admissionNo: string; message: string }>;
};

type BulkEnrollResult = {
  success: boolean;
  count: number;
  section: { id: string; name: string; gradeName: string };
  session: { id: string; name: string };
};

const SAMPLE_CSV = `firstName,lastName,admissionNo,gender,dateOfBirth,rollNo
Aarav,Sharma,ADM-9001,MALE,2014-05-01,1
Diya,Patel,ADM-9002,FEMALE,2014-08-12,2`;

export default function StudentsPage() {
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // --- Class filter state ---
  const [filterSessionId, setFilterSessionId] = useState('');
  const [filterGradeId, setFilterGradeId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');

  // --- Multi-select state ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- Bulk change session/grade target state ---
  const [targetSessionId, setTargetSessionId] = useState('');
  const [targetGradeId, setTargetGradeId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [bulkEnrollBusy, setBulkEnrollBusy] = useState(false);

  // --- Bulk CSV/Excel state ---
  const [bulkText, setBulkText] = useState(SAMPLE_CSV);
  const [bulkSessionId, setBulkSessionId] = useState('');
  const [bulkSectionId, setBulkSectionId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  // --- Permissions ---
  const [canCreate, setCanCreate] = useState(false);
  const [canEnroll, setCanEnroll] = useState(false);
  const [canBulk, setCanBulk] = useState(false);

  useEffect(() => {
    const role = getSession()?.role;
    setCanCreate(role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN' || role === 'TEACHER' || role === 'CLASS_TEACHER');
    setCanEnroll(role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN' || role === 'CLASS_TEACHER');
    setCanBulk(role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN');
  }, []);

        const load = useCallback(
          async (search = q, sessionId = filterSessionId, sectionId = filterSectionId) => {
            setLoading(true);
            setError(null);
            setSelectedIds(new Set());
            try {
              const params = new URLSearchParams();
              if (search.trim()) params.set('q', search.trim());
              if (sessionId) params.set('sessionId', sessionId);
              if (sectionId) params.set('sectionId', sectionId);
              const [list, g, s] = await Promise.all([
                apiFetch<Student[]>(`/students${params.toString() ? `?${params}` : ''}`),
                apiFetch<Grade[]>('/academic/grades'),
                apiFetch<Session[]>('/academic/sessions'),
              ]);
              setStudents(list);
              setGrades(g);
              setSessions(s);
              if (!bulkSessionId) {
                const current = s.find((session) => session.isCurrent) ?? s[0];
                if (current) setBulkSessionId(current.id);
              }
              if (!filterSessionId && !sessionId) {
                const current = s.find((session) => session.isCurrent) ?? s[0];
                if (current) setFilterSessionId(current.id);
              }
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Failed to load students');
            } finally {
              setLoading(false);
            }
},
[bulkSessionId, filterSessionId, filterSectionId, q],
  );

useEffect(() => {
  void load('', '', '');
  // initial load only
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const parsedBulk = useMemo(() => parseBulkStudentCsv(bulkText), [bulkText]);

const sections = useMemo(
  () => grades.flatMap((g) => (g.sections ?? []).map((s) => ({ id: s.id, label: `${g.name} - ${s.name}` }))),
  [grades],
);

// Sections filtered by selected filter-grade for the filter panel
const filterSections = useMemo(() => {
  if (!filterGradeId) return [];
  const grade = grades.find((g) => g.id === filterGradeId);
  return (grade?.sections ?? []).map((s) => ({ id: s.id, label: s.name }));
}, [filterGradeId, grades]);

// Sections filtered by selected target-grade for the bulk promote panel
const targetSections = useMemo(() => {
  if (!targetGradeId) return [];
  const grade = grades.find((g) => g.id === targetGradeId);
  return (grade?.sections ?? []).map((s) => ({ id: s.id, label: s.name }));
}, [targetGradeId, grades]);

const allSelected = students.length > 0 && selectedIds.size === students.length;

function toggleSelectAll() {
  if (allSelected) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(students.map((s) => s.id)));
  }
}

function toggleSelect(id: string) {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function handleFilterSubmit(e: FormEvent) {
  e.preventDefault();
  void load(q, filterSessionId, filterSectionId);
}

function handleFilterReset() {
  setQ('');
  setFilterSessionId('');
  setFilterGradeId('');
  setFilterSectionId('');
  void load('', '', '');
}

async function applyBulkEnroll() {
  setOk(null);
  setError(null);
  if (!targetSessionId) {
    setError('Select target academic session');
    return;
  }
  if (!targetSectionId) {
    setError('Select target grade and section');
    return;
  }
  if (selectedIds.size === 0) {
    setError('Select at least one student to change session / grade');
    return;
  }
  setBulkEnrollBusy(true);
  try {
    const result = await apiFetch<BulkEnrollResult>('/students/bulk-enroll', {
      method: 'POST',
      json: {
        studentIds: Array.from(selectedIds),
        sessionId: targetSessionId,
        sectionId: targetSectionId,
      },
    });
    setOk(
      `Successfully transferred ${result.count} student(s) to ${result.section.gradeName} - ${result.section.name} (${result.session.name})`,
    );
    setSelectedIds(new Set());
    await load(q, filterSessionId, filterSectionId);
  } catch (err) {
    setError(err instanceof ApiError ? err.message : 'Bulk enrollment / transfer failed');
  } finally {
    setBulkEnrollBusy(false);
  }
}

async function createStudent(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setOk(null);
  setError(null);
  const fd = new FormData(e.currentTarget);
  try {
    await apiFetch('/students', {
      method: 'POST',
      json: {
        firstName: String(fd.get('firstName') || ''),
        lastName: String(fd.get('lastName') || '') || undefined,
        admissionNo: String(fd.get('admissionNo') || ''),
        dateOfBirth: String(fd.get('dateOfBirth') || '') || undefined,
        gender: String(fd.get('gender') || '') || undefined,
      },
    });
    setOk('Student created');
    e.currentTarget.reset();
    await load(q, filterSessionId, filterSectionId);
  } catch (err) {
    setError(err instanceof ApiError ? err.message : 'Create failed');
  }
}

async function enrollStudent(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setOk(null);
  setError(null);
  const fd = new FormData(e.currentTarget);
  try {
    await apiFetch('/students/enroll', {
      method: 'POST',
      json: {
        studentId: String(fd.get('studentId') || ''),
        sectionId: String(fd.get('sectionId') || ''),
        sessionId: String(fd.get('sessionId') || ''),
        rollNo: String(fd.get('rollNo') || '') || undefined,
      },
    });
    setOk('Student enrolled');
    e.currentTarget.reset();
    await load(q, filterSessionId, filterSectionId);
  } catch (err) {
    setError(err instanceof ApiError ? err.message : 'Enroll failed');
  }
}

async function submitBulk() {
  setOk(null);
  setError(null);
  setBulkResult(null);

  if (!parsedBulk.rows.length) {
    setError(parsedBulk.errors[0]?.message ?? 'No valid student rows to import');
    return;
  }

  const enroll =
    bulkSessionId && bulkSectionId
      ? { sessionId: bulkSessionId, sectionId: bulkSectionId }
      : {};

  setBulkBusy(true);
  try {
    const result = await apiFetch<BulkResult>('/students/bulk', {
      method: 'POST',
      json: {
        students: parsedBulk.rows.map(({ line: _line, ...row }) => row),
        ...enroll,
      },
    });
    setBulkResult(result);
    setOk(
      `Bulk import finished · ${result.createdCount} created · ${result.failedCount} failed` +
      (parsedBulk.errors.length ? ` · ${parsedBulk.errors.length} parse warnings` : ''),
    );
    await load(q, filterSessionId, filterSectionId);
  } catch (err) {
    setError(err instanceof ApiError ? err.message : 'Bulk import failed');
  } finally {
    setBulkBusy(false);
  }
}

async function downloadSampleSheet() {
  setError(null);
  setSheetBusy(true);
  try {
    const token = getAccessToken();
    const res = await fetch('/api/students/bulk-template', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Could not download sample sheet');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'school-erp-bulk-students-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    setOk('Sample sheet downloaded · header row is locked; fill student rows and upload');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Download failed');
  } finally {
    setSheetBusy(false);
  }
}

async function onBulkFile(file: File | null) {
  if (!file) return;
  setError(null);
  setBulkResult(null);
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    setSheetBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      const token = getAccessToken();
      const res = await fetch('/api/students/parse-bulk-sheet', {
        method: 'POST',
        body: form,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json()) as { csv?: string; message?: string };
      if (!res.ok || !data.csv) {
        throw new Error(data.message ?? 'Could not read Excel sheet');
      }
      setBulkText(data.csv);
      setOk(`Loaded ${file.name} — review rows below, then Import students`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel upload failed');
    } finally {
      setSheetBusy(false);
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    setBulkText(String(reader.result ?? ''));
  };
  reader.readAsText(file);
}

return (
  <div className="space-y-4">
    {error ? <ErrorAlert>{error}</ErrorAlert> : null}
    {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

    {/* Class Filter Card */}
    <Card>
      <CardHeader
        title="Filter Students"
        description="Filter by session, grade, or section to view an existing class or find students"
      />
      <CardBody>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end" onSubmit={handleFilterSubmit}>
          <Select
            label="Academic Session"
            value={filterSessionId}
            onChange={(e) => setFilterSessionId(e.target.value)}
          >
            <option value="">All Sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.isCurrent ? '(Current)' : ''}
              </option>
            ))}
          </Select>

          <Select
            label="Grade"
            value={filterGradeId}
            onChange={(e) => {
              setFilterGradeId(e.target.value);
              setFilterSectionId('');
            }}
          >
            <option value="">All Grades</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>

          <Select
            label="Section"
            value={filterSectionId}
            onChange={(e) => setFilterSectionId(e.target.value)}
            disabled={!filterGradeId}
          >
            <option value="">{filterGradeId ? 'All Sections in Grade' : 'Select Grade first'}</option>
            {filterSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>

          <Input
            label="Search name / admission"
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1">
              Apply Filter
            </Button>
            <Button type="button" variant="outline" onClick={handleFilterReset}>
              Reset
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>

      {/* Bulk Promotion / Session Change Action Panel (visible when students selected & canEnroll) */}
      {canEnroll && selectedIds.size > 0 ? (
        <Card className="border-indigo-300 bg-indigo-50/50">
          <CardHeader
            title={`Bulk Change Session & Grade (${selectedIds.size} student${selectedIds.size === 1 ? '' : 's'} selected)`}
            description="Select target session and class to promote or transfer the selected students"
          />
          <CardBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                label="Target Academic Session *"
                value={targetSessionId}
                onChange={(e) => setTargetSessionId(e.target.value)}
                required
              >
                <option value="">Select Target Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isCurrent ? '(Current)' : ''}
                  </option>
                ))}
              </Select>

                <Select
                  label="Target Grade *"
                  value={targetGradeId}
                  onChange={(e) => {
                    setTargetGradeId(e.target.value);
                    setTargetSectionId('');
                  }}
                  required
                >
                  <option value="">Select Target Grade</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Target Section *"
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  disabled={!targetGradeId}
                  required
                >
                  <option value="">{targetGradeId ? 'Select Section' : 'Select Grade first'}</option>
                  {targetSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-slate-600">
                  This will enroll or update enrollment for <strong>{selectedIds.size}</strong> selected student(s) into the target session and section.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedIds(new Set())}
                    disabled={bulkEnrollBusy}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => void applyBulkEnroll()}
                    disabled={bulkEnrollBusy || !targetSessionId || !targetSectionId}
                  >
                    {bulkEnrollBusy ? 'Processing...' : `Promote / Transfer (${selectedIds.size})`}
                  </Button>
                </div>
              </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Students Table Card */}
      <Card>
        <CardHeader
          title="Students List"
          description={`Showing ${students.length} student${students.length === 1 ? '' : 's'}${selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ''}`}
        />
        <CardBody>
          {loading ? (
            <LoadingState />
          ) : (
            <>
              <Table className="dense-table">
                <THead>
                  <TR>
                    {canEnroll ? (
                      <TH className="w-10">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all students"
                        />
                      </TH>
                    ) : null}
                    <TH>Admission No</TH>
                    <TH>Name</TH>
                    <TH>Gender</TH>
                    <TH>Current Enrollment</TH>
                  </TR>
                </THead>
                <TBody>
                  {students.map((s) => {
                    const enr = s.enrollments?.[0];
                    const isChecked = selectedIds.has(s.id);
                    return (
                        <TR key={s.id} className={isChecked ? 'bg-indigo-50/60' : undefined}>
                          {canEnroll ? (
                            <TD className="w-10">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={isChecked}
                                onChange={() => toggleSelect(s.id)}
                                aria-label={`Select ${s.firstName} ${s.lastName ?? ''}`}
                              />
                            </TD>
                          ) : null}
                          <TD className="font-medium">{s.admissionNo}</TD>
                          <TD>
                            {s.firstName} {s.lastName ?? ''}
                          </TD>
                          <TD>{s.gender ?? '—'}</TD>
                          <TD>
                            {enr
                              ? `${enr.section?.grade?.name ?? ''} ${enr.section?.name ?? ''} · ${enr.session?.name ?? ''}${enr.rollNo ? ` · Roll ${enr.rollNo}` : ''}`
                              : 'Not enrolled'}
                          </TD>
                        </TR>
                        );
                  })}
                      </TBody>
              </Table>
              {!students.length ? <EmptyState label="No students found matching current filters" /> : null}
            </>
          )}
        </CardBody>
      </Card>

      {/* Bulk CSV / Excel Upload */}
      {canBulk ? (
                <Card className="no-print">
                  <CardHeader
                    title="Bulk add students"
                    description="Download the official Excel sample (locked headers), fill student rows, then upload. Optional: enroll all into one class."
                    actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sheetBusy}
                onClick={() => void downloadSampleSheet()}
              >
                {sheetBusy ? 'Preparing…' : 'Download sample sheet'}
              </Button>
                    }
                  />
                  <CardBody className="space-y-4">
                    <div className="rounded-md border border-teal-200 bg-teal-50/80 px-3 py-2 text-sm text-teal-950">
                      Format: <code className="text-xs">firstName, lastName, admissionNo, gender, dateOfBirth, rollNo</code>
                      — header row is protected so columns stay fixed.
                    </div>

                          <div className="grid gap-3 lg:grid-cols-3">
                            <Select
                              label="Auto-enroll session (optional)"
                              value={bulkSessionId}
                              onChange={(e) => setBulkSessionId(e.target.value)}
                            >
                              <option value="">Do not enroll now</option>
                              {sessions.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </Select>
                              <Select
                                label="Auto-enroll section (optional)"
                                value={bulkSectionId}
                                onChange={(e) => setBulkSectionId(e.target.value)}
                                disabled={!bulkSessionId}
                              >
                                <option value="">Select section</option>
                                {sections.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </Select>
                            <Input
                              label="Upload filled sheet"
                              type="file"
                              accept=".xlsx,.xlsm,.csv,text/csv,text/plain"
                              disabled={sheetBusy}
                              onChange={(e) => void onBulkFile(e.target.files?.[0] ?? null)}
                            />
                          </div>

                          <Textarea
                            label="Preview (from sheet / CSV)"
                            value={bulkText}
                            onChange={(e) => {
                              setBulkText(e.target.value);
                              setBulkResult(null);
                            }}
                            className="min-h-[160px] font-mono text-xs"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-slate-600">
                              Parsed <span className="font-semibold text-slate-900">{parsedBulk.rows.length}</span> valid
                              row{parsedBulk.rows.length === 1 ? '' : 's'}
                              {parsedBulk.errors.length
                                ? ` · ${parsedBulk.errors.length} parse issue${parsedBulk.errors.length === 1 ? '' : 's'}`
                                : ''}
                              {bulkSessionId && bulkSectionId ? ' · will auto-enroll' : ''}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setBulkText(SAMPLE_CSV);
                                  setBulkResult(null);
                                }}
                              >
                                Reset preview
                              </Button>
                              <Button
                                type="button"
                                onClick={() => void submitBulk()}
                                disabled={bulkBusy || sheetBusy}
                              >
                                {bulkBusy ? 'Importing…' : 'Import students'}
                              </Button>
                            </div>
                          </div>

                          {parsedBulk.errors.length ? (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                              <p className="font-medium">Parse issues</p>
                              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                {parsedBulk.errors.slice(0, 8).map((issue) => (
                                  <li key={`${issue.line}-${issue.message}`}>
                                    Line {issue.line}: {issue.message}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {bulkResult ? (
                            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                              <p>
                                Server result: <strong>{bulkResult.createdCount}</strong> created,{' '}
                                <strong>{bulkResult.failedCount}</strong> failed
                              </p>
                              {bulkResult.errors.length ? (
                                <ul className="list-disc space-y-0.5 pl-5 text-rose-700">
                                  {bulkResult.errors.slice(0, 10).map((issue) => (
                                    <li key={`${issue.admissionNo}-${issue.message}`}>
                                      {issue.admissionNo}: {issue.message}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}

                          <p className="text-xs text-slate-500">
                            Prefer the downloaded .xlsx template. Gender: MALE/FEMALE/OTHER. DOB: YYYY-MM-DD. Max 500
                            rows per import. Do not rename or reorder header columns.
                          </p>
                      </CardBody>
                    </Card>
              ) : null}

              {/* Create / Enroll Individual Cards */}
              {canCreate || canEnroll ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {canCreate ? (
                    <Card className="no-print">
                      <CardHeader title="Create student" />
                      <CardBody>
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={createStudent}>
                          <Input name="firstName" label="First name" required />
                          <Input name="lastName" label="Last name" />
                          <Input name="admissionNo" label="Admission no" required />
                          <Input name="dateOfBirth" label="Date of birth" type="date" max={todayIsoDate()} />
                          <Select name="gender" label="Gender" defaultValue="">
                            <option value="">—</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </Select>
                          <div className="flex items-end">
                            <Button type="submit">Create</Button>
                          </div>
                        </form>
                      </CardBody>
                    </Card>
                  ) : null}

                  {canEnroll ? (
                    <Card className="no-print">
                      <CardHeader title="Enroll student" />
                      <CardBody>
                        <form className="space-y-3" onSubmit={enrollStudent}>
                          <Select name="studentId" label="Student" required defaultValue="">
                            <option value="">Select student</option>
                            {students.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.admissionNo} — {s.firstName} {s.lastName ?? ''}
                              </option>
                            ))}
                          </Select>
                          <Select
                            name="sessionId"
                            label="Session"
                            required
                            defaultValue={sessions.find((s) => s.isCurrent)?.id ?? ''}
                          >
                            <option value="">Select session</option>
                            {sessions.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </Select>
                          <Select name="sectionId" label="Section" required defaultValue="">
                            <option value="">Select section</option>
                            {sections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </Select>
                          <Input name="rollNo" label="Roll no" />
                          <Button type="submit">Enroll</Button>
                        </form>
                      </CardBody>
                    </Card>
                  ) : null}
                </div>
              ) : null}
            </div>
            );
}
