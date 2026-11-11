'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';
import { BusyOverlay } from '@/components/ui/spinner';
import {
  QuestionEditorOverlay,
  emptyQuestionDraft,
  normalizeQuestionType,
  questionTypeBadgeLabel,
  type QuestionDraft,
  type StaffQuestionType,
} from './question-editor';

type Session = { id: string; name: string; isCurrent: boolean };
type Grade = { id: string; name: string; sections: Array<{ id: string; name: string }> };

type AssessmentListItem = {
  id: string;
  title: string;
  joinCode: string;
  status: string;
  durationMinutes: number;
  maxWarnings: number;
  session?: { name: string };
  _count?: { questions: number; enrollments: number; attempts: number };
};

type QuestionRow = {
  id: string;
  type: string;
  stem: string;
  marks: number;
  sortOrder: number;
  options: Array<{ id: string; text: string; isCorrect?: boolean }>;
};

type AssessmentDetail = AssessmentListItem & {
  requireCamera: boolean;
  faceAbsentSeconds: number;
  questions: QuestionRow[];
  enrollments: Array<{
    id: string;
    enrollment: {
      student: { firstName: string; lastName?: string | null; admissionNo: string };
      section?: { name: string; grade?: { name: string } };
    };
  }>;
  attempts: Array<{
    id: string;
    status: string;
    warningCount: number;
    score: number | null;
    maxScore: number | null;
    lockReasonCode: string | null;
    lockReasonMessage: string | null;
    enrollment: { student: { firstName: string; admissionNo: string } };
    proctorEvents: Array<{ id: string; type: string; message: string | null; at: string }>;
  }>;
};

function toDraft(q: QuestionRow): QuestionDraft {
  return {
    id: q.id,
    type: normalizeQuestionType(q.type),
    stem: q.stem,
    marks: q.marks,
    sortOrder: q.sortOrder,
    options: (q.options ?? []).map((o) => ({
      id: o.id,
      text: o.text,
      isCorrect: Boolean(o.isCorrect),
    })),
  };
}

export default function OnlineExamsPage() {
  const [list, setList] = useState<AssessmentListItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [statusPending, setStatusPending] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [deletingExam, setDeletingExam] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [canUnlock, setCanUnlock] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<QuestionDraft>(emptyQuestionDraft());
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const sections = useMemo(
    () =>
      grades.flatMap((g) =>
        (g.sections ?? []).map((s) => ({ id: s.id, label: `${g.name} - ${s.name}` })),
      ),
    [grades],
  );

  const monitorBusy =
    detailLoading ||
    enrolling ||
    statusPending != null ||
    deletingQuestionId != null ||
    unlockingId != null ||
    deletingExam ||
    savingSettings;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, s, g] = await Promise.all([
        apiFetch<AssessmentListItem[]>('/online-assessments'),
        apiFetch<Session[]>('/academic/sessions'),
        apiFetch<Grade[]>('/academic/grades'),
      ]);
      setList(items);
      setSessions(s);
      setGrades(g);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load online exams');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string, opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setDetailLoading(true);
    setError(null);
    try {
      const d = await apiFetch<AssessmentDetail>(`/online-assessments/${id}`);
      setDetail(d);
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load assessment');
    } finally {
      if (!opts?.quiet) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const role = getSession()?.role;
    setCanUnlock(role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN' || role === 'CLASS_TEACHER');
    void load();
  }, [load]);

  // Quiet live refresh while exam is LIVE (no busy overlay spam)
  useEffect(() => {
    if (!selectedId || detail?.status !== 'LIVE') return;
    const timer = window.setInterval(() => {
      void loadDetail(selectedId, { quiet: true });
    }, 18_000);
    return () => window.clearInterval(timer);
  }, [selectedId, detail?.status, loadDetail]);

  async function createAssessment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setError(null);
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    try {
      const created = await apiFetch<AssessmentListItem>('/online-assessments', {
        method: 'POST',
        json: {
          title: String(fd.get('title') || ''),
          sessionId: String(fd.get('sessionId') || ''),
          durationMinutes: Number(fd.get('durationMinutes') || 60),
          pin: String(fd.get('pin') || '') || undefined,
          requireCamera: String(fd.get('requireCamera') || 'true') === 'true',
          maxWarnings: Number(fd.get('maxWarnings') || 3),
          faceAbsentSeconds: Number(fd.get('faceAbsentSeconds') || 10),
          status: String(fd.get('status') || 'DRAFT'),
          questions: [],
        },
      });
      setOk(`Created · join code ${created.joinCode}. Add questions with the full-screen editor.`);
      form.reset();
      await load();
      setSelectedId(created.id);
      await loadDetail(created.id, { quiet: true });
      setEditorMode('add');
      setEditorDraft(emptyQuestionDraft(0));
      setEditorError(null);
      setEditorOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  function openAddQuestion() {
    if (!selectedId || monitorBusy) return;
    setEditorMode('add');
    setEditorDraft(emptyQuestionDraft(detail?.questions.length ?? 0));
    setEditorError(null);
    setEditorOpen(true);
  }

  function openEditQuestion(q: QuestionRow) {
    if (monitorBusy) return;
    setEditorMode('edit');
    setEditorDraft(toDraft(q));
    setEditorError(null);
    setEditorOpen(true);
  }

  async function saveQuestion(draft: QuestionDraft) {
    if (!selectedId) return;
    setEditorSaving(true);
    setEditorError(null);
    setError(null);
    const payload = {
      type: draft.type as StaffQuestionType,
      stem: draft.stem,
      marks: draft.marks,
      sortOrder: draft.sortOrder,
      options: draft.options,
    };
    try {
      if (editorMode === 'edit' && draft.id) {
        await apiFetch('/online-assessments/questions', {
          method: 'PUT',
          json: {
            assessmentId: selectedId,
            questionId: draft.id,
            question: payload,
          },
        });
        setOk('Question updated');
      } else {
        await apiFetch('/online-assessments/questions', {
          method: 'POST',
          json: {
            assessmentId: selectedId,
            question: payload,
          },
        });
        setOk('Question added');
      }
      setEditorOpen(false);
      await loadDetail(selectedId, { quiet: true });
      await load();
    } catch (err) {
      setEditorError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setEditorSaving(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!selectedId) return;
    if (!window.confirm('Delete this question?')) return;
    setOk(null);
    setError(null);
    setDeletingQuestionId(questionId);
    try {
      await apiFetch('/online-assessments/questions/delete', {
        method: 'POST',
        json: { assessmentId: selectedId, questionId },
      });
      setOk('Question deleted');
      await loadDetail(selectedId, { quiet: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setDeletingQuestionId(null);
    }
  }

  async function enrollSection() {
    if (!selectedId || !sectionId) return;
    setOk(null);
    setError(null);
    setEnrolling(true);
    try {
      const res = await apiFetch<{ created: number; totalEligible: number }>(
        '/online-assessments/enroll-section',
        { method: 'POST', json: { assessmentId: selectedId, sectionId } },
      );
      setOk(`Enrolled ${res.created} of ${res.totalEligible} students`);
      await loadDetail(selectedId, { quiet: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enroll failed');
    } finally {
      setEnrolling(false);
    }
  }

  async function setStatus(status: string) {
    if (!selectedId) return;
    setStatusPending(status);
    setOk(null);
    setError(null);
    try {
      await apiFetch('/online-assessments/status', {
        method: 'POST',
        json: { assessmentId: selectedId, status },
      });
      setOk(`Status → ${status}`);
      await loadDetail(selectedId, { quiet: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Status update failed');
    } finally {
      setStatusPending(null);
    }
  }

  async function unlock(attemptId: string) {
    setOk(null);
    setError(null);
    setUnlockingId(attemptId);
    try {
      await apiFetch('/online-assessments/unlock', {
        method: 'POST',
        json: { attemptId, resetWarnings: false },
      });
      setOk('Attempt unlocked');
      if (selectedId) await loadDetail(selectedId, { quiet: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unlock failed');
    } finally {
      setUnlockingId(null);
    }
  }

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId || !detail) return;
    setOk(null);
    setError(null);
    setSavingSettings(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/online-assessments/settings', {
        method: 'POST',
        json: {
          assessmentId: selectedId,
          title: String(fd.get('title') || detail.title),
          durationMinutes: Number(fd.get('durationMinutes') || detail.durationMinutes),
          requireCamera: String(fd.get('requireCamera') || 'true') === 'true',
          maxWarnings: Number(fd.get('maxWarnings') || detail.maxWarnings),
          faceAbsentSeconds: Number(fd.get('faceAbsentSeconds') || detail.faceAbsentSeconds),
        },
      });
      setOk('Exam settings saved');
      await loadDetail(selectedId, { quiet: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Settings save failed');
    } finally {
      setSavingSettings(false);
    }
  }

  async function deleteExam() {
    if (!selectedId || !detail) return;
    if (!window.confirm(`Delete exam “${detail.title}”? This cannot be undone.`)) return;
    setOk(null);
    setError(null);
    setDeletingExam(true);
    try {
      await apiFetch('/online-assessments/delete', {
        method: 'POST',
        json: { assessmentId: selectedId },
      });
      setOk('Exam deleted');
      setDetail(null);
      setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setDeletingExam(false);
    }
  }

  return (
    <div className="space-y-4" aria-busy={creating || editorSaving || deletingExam || undefined}>
      <BusyOverlay open={creating} label="Creating exam…" />
      <BusyOverlay open={editorSaving} label={editorMode === 'edit' ? 'Saving question…' : 'Adding question…'} />
      <BusyOverlay open={deletingExam} label="Deleting exam…" />
      <BusyOverlay open={savingSettings} label="Saving settings…" />

      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      <Card>
        <CardHeader
          title="Online exams"
          description="Host timed exams with single-choice, multiple-correct, Yes/No, and This-or-That questions. Students join with code + admission number."
        />
        <CardBody>
          {loading ? (
            <LoadingState label="Loading online exams…" />
          ) : (
            <>
              <Table className="dense-table">
                <THead>
                  <TR>
                    <TH>Title</TH>
                    <TH>Join code</TH>
                    <TH>Status</TH>
                    <TH>Q / Enrolled / Attempts</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {list.map((item) => {
                    const opening = detailLoading && selectedId === item.id;
                    return (
                      <TR key={item.id}>
                        <TD className="font-medium">{item.title}</TD>
                        <TD>
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">{item.joinCode}</code>
                        </TD>
                        <TD>{item.status}</TD>
                        <TD>
                          {item._count?.questions ?? 0} / {item._count?.enrollments ?? 0} /{' '}
                          {item._count?.attempts ?? 0}
                        </TD>
                        <TD>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={opening}
                            loadingLabel="Opening…"
                            disabled={detailLoading && !opening}
                            onClick={() => void loadDetail(item.id)}
                          >
                            Open
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              {!list.length ? <EmptyState label="No online exams yet" /> : null}
            </>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Create online exam"
            description="Creates an exam shell (default DRAFT), then opens the full-screen question editor."
          />
          <CardBody>
            <form className="space-y-3" onSubmit={createAssessment} aria-busy={creating || undefined}>
              <Input name="title" label="Title" required placeholder="Class 6 Science Quiz" disabled={creating} />
              <Select
                name="sessionId"
                label="Session"
                required
                defaultValue={sessions.find((s) => s.isCurrent)?.id ?? ''}
                disabled={creating}
              >
                <option value="">Select session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="durationMinutes"
                  label="Duration (min)"
                  type="number"
                  defaultValue={60}
                  min={5}
                  max={360}
                  disabled={creating}
                />
                <Input name="pin" label="Optional PIN" placeholder="1234" disabled={creating} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select name="status" label="Initial status" defaultValue="DRAFT" disabled={creating}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="LIVE">LIVE</option>
                </Select>
                <Select name="requireCamera" label="Require camera" defaultValue="true" disabled={creating}>
                  <option value="true">On</option>
                  <option value="false">Off</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="maxWarnings"
                  label="Max camera warnings"
                  type="number"
                  defaultValue={3}
                  min={1}
                  max={10}
                  disabled={creating}
                />
                <Input
                  name="faceAbsentSeconds"
                  label="Face absent (sec)"
                  type="number"
                  defaultValue={10}
                  min={5}
                  max={600}
                  disabled={creating}
                />
              </div>
              <Button type="submit" loading={creating} loadingLabel="Creating exam…">
                Create exam & add questions
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={detail ? detail.title : 'Monitor'}
            description={
              detail
                ? `Join code ${detail.joinCode} · warnings max ${detail.maxWarnings} · camera ${detail.requireCamera ? 'on' : 'off'}`
                : 'Select an exam to enroll students and watch attempts'
            }
          />
          <CardBody className="space-y-4" aria-busy={monitorBusy || undefined}>
            {detailLoading && !detail ? (
              <LoadingState label="Loading exam…" />
            ) : !detail ? (
              <EmptyState label="Open an exam from the list" />
            ) : (
              <>
                {detailLoading ? <LoadingState label="Refreshing exam…" /> : null}
                {detail.status === 'LIVE' ? (
                  <p className="text-xs text-teal-800">Live monitor: refreshing about every 18s</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={statusPending === 'LIVE'}
                    loadingLabel="Setting LIVE…"
                    disabled={monitorBusy && statusPending !== 'LIVE'}
                    onClick={() => void setStatus('LIVE')}
                  >
                    Set LIVE
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={statusPending === 'CLOSED'}
                    loadingLabel="Closing…"
                    disabled={monitorBusy && statusPending !== 'CLOSED'}
                    onClick={() => void setStatus('CLOSED')}
                  >
                    Close
                  </Button>
                  <a
                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    href="/take-exam"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open student join page
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={deletingExam}
                    loadingLabel="Deleting…"
                    disabled={monitorBusy && !deletingExam}
                    onClick={() => void deleteExam()}
                  >
                    Delete exam
                  </Button>
                </div>

                <form
                  key={`${detail.id}-${detail.requireCamera}-${detail.maxWarnings}-${detail.faceAbsentSeconds}-${detail.title}-${detail.durationMinutes}`}
                  className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                  onSubmit={saveSettings}
                >
                  <p className="text-sm font-medium text-slate-700">Exam settings</p>
                  <Input name="title" label="Title" defaultValue={detail.title} disabled={savingSettings} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      name="durationMinutes"
                      label="Duration (min)"
                      type="number"
                      min={5}
                      max={360}
                      defaultValue={detail.durationMinutes}
                      disabled={savingSettings}
                    />
                    <Select
                      name="requireCamera"
                      label="Require camera"
                      defaultValue={detail.requireCamera ? 'true' : 'false'}
                      disabled={savingSettings}
                    >
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      name="maxWarnings"
                      label="Max warnings"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={detail.maxWarnings}
                      disabled={savingSettings}
                    />
                    <Input
                      name="faceAbsentSeconds"
                      label="Face absent (sec)"
                      type="number"
                      min={5}
                      max={600}
                      defaultValue={detail.faceAbsentSeconds}
                      disabled={savingSettings}
                    />
                  </div>
                  <Button type="submit" size="sm" loading={savingSettings} loadingLabel="Saving…">
                    Save settings
                  </Button>
                </form>

                <div className="flex flex-wrap items-end gap-2">
                  <Select
                    label="Enroll section"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    disabled={enrolling}
                  >
                    <option value="">Select section</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    loading={enrolling}
                    loadingLabel="Enrolling…"
                    disabled={!sectionId || (monitorBusy && !enrolling)}
                    onClick={() => void enrollSection()}
                  >
                    Enroll class
                  </Button>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700">
                      Questions ({detail.questions.length})
                    </p>
                    <Button type="button" size="sm" disabled={monitorBusy} onClick={() => openAddQuestion()}>
                      Add question
                    </Button>
                  </div>
                  <ul className="max-h-56 space-y-2 overflow-auto">
                    {detail.questions.map((q, idx) => {
                      const deleting = deletingQuestionId === q.id;
                      return (
                        <li
                          key={q.id}
                          className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">Q{idx + 1}</span>
                              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-900">
                                {questionTypeBadgeLabel(q.type)}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {q.marks} mark{q.marks === 1 ? '' : 's'}
                              </span>
                            </div>
                            <p className="truncate text-sm text-slate-800">{q.stem}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={monitorBusy}
                              onClick={() => openEditQuestion(q)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              loading={deleting}
                              loadingLabel="Deleting…"
                              disabled={monitorBusy && !deleting}
                              onClick={() => void deleteQuestion(q.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {!detail.questions.length ? (
                    <p className="text-sm text-slate-500">No questions yet — add one in the full-screen editor.</p>
                  ) : null}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Enrolled ({detail.enrollments.length})
                  </p>
                  <ul className="max-h-28 space-y-1 overflow-auto text-sm text-slate-600">
                    {detail.enrollments.map((row) => (
                      <li key={row.id}>
                        {row.enrollment.student.admissionNo} — {row.enrollment.student.firstName}{' '}
                        {row.enrollment.student.lastName ?? ''}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Attempts</p>
                  <div className="space-y-2">
                    {detail.attempts.map((a) => {
                      const unlocking = unlockingId === a.id;
                      const expanded = expandedAttemptId === a.id;
                      const events = a.proctorEvents ?? [];
                      return (
                        <div
                          key={a.id}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {a.enrollment.student.admissionNo}{' '}
                                <span className="font-normal text-slate-600">
                                  · {a.enrollment.student.firstName}
                                </span>
                              </p>
                              <p className="text-xs text-slate-500">
                                {a.status} · warnings {a.warningCount}
                                {a.score != null ? ` · score ${a.score}/${a.maxScore ?? '—'}` : ''}
                              </p>
                              {a.lockReasonMessage ? (
                                <p className="mt-1 text-xs text-rose-700">{a.lockReasonMessage}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setExpandedAttemptId((cur) => (cur === a.id ? null : a.id))
                                }
                              >
                                {expanded ? 'Hide events' : `Events (${events.length})`}
                              </Button>
                              {canUnlock && a.status === 'LOCKED' ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  loading={unlocking}
                                  loadingLabel="Unlocking…"
                                  disabled={monitorBusy && !unlocking}
                                  onClick={() => void unlock(a.id)}
                                >
                                  Unlock
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          {expanded ? (
                            <ul className="mt-2 max-h-40 space-y-1 overflow-auto border-t border-slate-100 pt-2 text-xs text-slate-600">
                              {events.length ? (
                                events.map((ev) => (
                                  <li key={ev.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                                    <time className="shrink-0 text-slate-400">
                                      {new Date(ev.at).toLocaleString()}
                                    </time>
                                    <span className="font-semibold text-slate-800">{ev.type}</span>
                                    {ev.message ? <span>{ev.message}</span> : null}
                                  </li>
                                ))
                              ) : (
                                <li>No proctor events yet</li>
                              )}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {!detail.attempts.length ? (
                    <p className="text-sm text-slate-500">No attempts yet</p>
                  ) : null}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <QuestionEditorOverlay
        open={editorOpen}
        title={editorMode === 'edit' ? 'Edit question' : 'Add question'}
        initial={editorDraft}
        saving={editorSaving}
        error={editorError}
        onClose={() => {
          if (!editorSaving) setEditorOpen(false);
        }}
        onSave={saveQuestion}
      />
    </div>
  );
}
