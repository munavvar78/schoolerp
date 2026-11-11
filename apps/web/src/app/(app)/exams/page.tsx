'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { sessionCanPublishExam, sessionCanTeach } from '@/lib/write-roles';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Exam = {
  id: string;
  name: string;
  grade?: { id: string; name: string };
  session?: { id: string; name: string };
  components: Array<{ id: string; name: string; maxMarks: number; weight: number; subjectId?: string | null }>;
  publications?: Array<{ id: string }>;
};

type Grade = { id: string; name: string; sections: Array<{ id: string; name: string }> };
type Session = { id: string; name: string; isCurrent: boolean };
type Subject = { id: string; name: string };
type Student = {
  id: string;
  firstName: string;
  lastName?: string | null;
  enrollments?: Array<{ id: string; sectionId: string; sessionId: string }>;
};
type ResultRow = {
  enrollmentId: string;
  student?: { firstName: string; lastName?: string | null };
  totals?: { obtained: number; max: number; percentage: number };
  grade?: { grade: string; isPass: boolean };
};

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [scoreEnrollmentId, setScoreEnrollmentId] = useState('');
  const [scoreComponentId, setScoreComponentId] = useState('');
  const [obtained, setObtained] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canPublish, setCanPublish] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const editor = sessionCanTeach();
    setCanEdit(editor);
    setCanPublish(sessionCanPublishExam());
    try {
      if (!editor) {
        const e = await apiFetch<Exam[]>('/exams');
        setExams(e);
        if (!selectedExamId && e[0]) setSelectedExamId(e[0].id);
        return;
      }
      const [e, g, s, sub, st] = await Promise.all([
        apiFetch<Exam[]>('/exams'),
        apiFetch<Grade[]>('/academic/grades'),
        apiFetch<Session[]>('/academic/sessions'),
        apiFetch<Subject[]>('/academic/subjects'),
        apiFetch<Student[]>('/students'),
      ]);
      setExams(e);
      setGrades(g);
      setSessions(s);
      setSubjects(sub);
      setStudents(st);
      if (!selectedExamId && e[0]) setSelectedExamId(e[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  }, [selectedExamId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null;

  async function createExam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/exams', {
        method: 'POST',
        json: {
          name: String(fd.get('name') || ''),
          sessionId: String(fd.get('sessionId') || ''),
          gradeId: String(fd.get('gradeId') || ''),
          startDate: String(fd.get('startDate') || '') || undefined,
          endDate: String(fd.get('endDate') || '') || undefined,
          components: [
            {
              name: String(fd.get('componentName') || 'Theory'),
              maxMarks: Number(fd.get('maxMarks') || 100),
              weight: Number(fd.get('weight') || 1),
              subjectId: String(fd.get('subjectId') || '') || undefined,
            },
          ],
        },
      });
      setOk('Exam created');
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create exam failed');
    }
  }

  async function saveScore(e: FormEvent) {
    e.preventDefault();
    if (!selectedExam) return;
    try {
      await apiFetch('/exams/scores', {
        method: 'POST',
        json: {
          examId: selectedExam.id,
          scores: [
            {
              enrollmentId: scoreEnrollmentId,
              componentId: scoreComponentId || selectedExam.components[0]?.id,
              obtained: obtained === '' ? null : Number(obtained),
            },
          ],
        },
      });
      setOk('Score saved');
      setObtained('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save score failed');
    }
  }

  async function publishExam(id: string) {
    try {
      await apiFetch(`/exams/${id}/publish`, { method: 'POST' });
      setOk('Exam published');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Publish failed');
    }
  }

  async function viewResults(id: string) {
    setSelectedExamId(id);
    try {
      const data = await apiFetch<ResultRow[]>(`/exams/${id}/results`);
      setResults(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load results');
      setResults(null);
    }
  }

  const enrollmentsForExam = students.flatMap((s) =>
    (s.enrollments ?? [])
      .filter((en) => !selectedExam || en.sessionId === selectedExam.session?.id)
      .map((en) => ({
        id: en.id,
        label: `${s.firstName} ${s.lastName ?? ''}`.trim(),
      })),
  );

  if (loading) return <LoadingState label="Loading exams…" />;

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      <Card>
        <CardHeader title="Exams" description="Create, score, publish and review results" />
        <CardBody>
          <Table className="dense-table">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Grade</TH>
                <TH>Session</TH>
                <TH>Components</TH>
                <TH>Status</TH>
                <TH className="no-print">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {exams.map((exam) => (
                <TR key={exam.id}>
                  <TD className="font-medium">{exam.name}</TD>
                  <TD>{exam.grade?.name ?? '—'}</TD>
                  <TD>{exam.session?.name ?? '—'}</TD>
                  <TD>{exam.components.map((c) => c.name).join(', ')}</TD>
                  <TD>
                    {exam.publications?.length ? (
                      <Badge tone="green">Published</Badge>
                    ) : (
                      <Badge tone="amber">Draft</Badge>
                    )}
                  </TD>
                  <TD className="no-print">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void viewResults(exam.id)}>
                        Results
                      </Button>
                      {canPublish && !exam.publications?.length ? (
                        <Button size="sm" onClick={() => void publishExam(exam.id)}>
                          Publish
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {!exams.length ? <EmptyState label="No exams yet" /> : null}
        </CardBody>
      </Card>

      {canEdit ? (
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="no-print">
          <CardHeader title="Create exam" />
          <CardBody>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={createExam}>
              <Input name="name" label="Exam name" required placeholder="Term 1" />
              <Select name="sessionId" label="Session" required defaultValue={sessions.find((s) => s.isCurrent)?.id ?? ''}>
                <option value="">Select</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select name="gradeId" label="Grade" required defaultValue="">
                <option value="">Select</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
              <Select name="subjectId" label="Subject" defaultValue="">
                <option value="">Optional</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input name="componentName" label="Component" defaultValue="Theory" required />
              <Input name="maxMarks" label="Max marks" type="number" defaultValue={100} required />
              <Input name="weight" label="Weight" type="number" step="0.1" defaultValue={1} required />
              <Input name="startDate" label="Start" type="date" />
              <Input name="endDate" label="End" type="date" />
              <div className="flex items-end sm:col-span-2">
                <Button type="submit">Create exam</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="no-print">
          <CardHeader title="Enter scores" />
          <CardBody>
            <form className="space-y-3" onSubmit={saveScore}>
              <Select label="Exam" value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Component"
                value={scoreComponentId || selectedExam?.components[0]?.id || ''}
                onChange={(e) => setScoreComponentId(e.target.value)}
              >
                {(selectedExam?.components ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (max {c.maxMarks})
                  </option>
                ))}
              </Select>
              <Select label="Enrollment" required value={scoreEnrollmentId} onChange={(e) => setScoreEnrollmentId(e.target.value)}>
                <option value="">Select student enrollment</option>
                {enrollmentsForExam.map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Obtained marks"
                type="number"
                step="0.5"
                value={obtained}
                onChange={(e) => setObtained(e.target.value)}
              />
              <Button type="submit" disabled={!selectedExam || !scoreEnrollmentId}>
                Save score
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
      ) : null}

      {results ? (
        <Card>
          <CardHeader title="Results" description={selectedExam?.name} />
          <CardBody>
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Enrollment</TH>
                  <TH>Student</TH>
                  <TH>Total</TH>
                  <TH>%</TH>
                  <TH>Grade</TH>
                </TR>
              </THead>
              <TBody>
                {results.map((r) => (
                  <TR key={r.enrollmentId}>
                    <TD className="font-mono text-xs">{r.enrollmentId.slice(0, 8)}…</TD>
                    <TD>
                      {r.student
                        ? `${r.student.firstName} ${r.student.lastName ?? ''}`.trim()
                        : '—'}
                    </TD>
                    <TD>{r.totals?.obtained ?? '—'}</TD>
                    <TD>{r.totals?.percentage != null ? `${r.totals.percentage}%` : '—'}</TD>
                    <TD>{r.grade?.grade ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!results.length ? <EmptyState label="No results yet" /> : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
