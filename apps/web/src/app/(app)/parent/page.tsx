'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { formatInr } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState } from '@/components/ui/alert';

type Child = {
  id: string;
  firstName: string;
  lastName?: string | null;
  admissionNo: string;
  enrollments?: Array<{
    id: string;
    sectionId?: string;
    sessionId?: string;
    rollNo?: string | null;
    section?: { id?: string; name: string; grade?: { name: string } };
    session?: { id?: string; name: string; isCurrent?: boolean };
  }>;
};

type Outstanding = {
  id: string;
  periodLabel: string;
  outstandingPaise: number;
  dueDate: string;
  enrollment?: { studentId?: string; student?: { id: string; admissionNo: string } };
};

type Exam = { id: string; name: string; publications?: Array<{ id: string }> };

type AttendanceRate = { percentage: number; presentDays?: number; totalDays?: number };

type Notice = {
  id: string;
  title: string;
  body: string;
  category: string;
  publishedAt?: string | null;
  receipts?: Array<{ id: string }>;
};

type HomeworkItem = {
  id: string;
  title: string;
  dueDate: string;
  subject?: { name: string };
  section?: { name: string; grade?: { name: string } };
  childCompletions?: Array<{ status: string }>;
};

type TimetableEntry = {
  id: string;
  dayOfWeek: number;
  periodSlot?: { label: string; startTime: string; endTime: string };
  subject?: { name: string };
};

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ParentPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [fees, setFees] = useState<Outstanding[]>([]);
  const [examSummaries, setExamSummaries] = useState<
    Array<{ examName: string; childName: string; percentage?: number; grade?: string }>
  >([]);
  const [attendance, setAttendance] = useState<Array<{ childName: string; percentage: number }>>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (getSession()?.role !== 'PARENT') {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const kids = await apiFetch<Child[]>('/students/my-children');
        setChildren(kids);

        const [inbox, hw] = await Promise.all([
          apiFetch<Notice[]>('/notices/inbox').catch(() => []),
          apiFetch<HomeworkItem[]>('/homework/mine').catch(() => []),
        ]);
        setNotices(inbox);
        setHomework(hw);

        const firstEnr =
          kids[0]?.enrollments?.find((e) => e.session?.isCurrent) ?? kids[0]?.enrollments?.[0];
        if (firstEnr) {
          const sid = firstEnr.sectionId ?? firstEnr.section?.id;
          const sessId = firstEnr.sessionId ?? firstEnr.session?.id;
          if (sid && sessId) {
            const grid = await apiFetch<TimetableEntry[]>(
              `/timetable/section?sectionId=${sid}&sessionId=${sessId}`,
            ).catch(() => []);
            setTimetable(grid);
          }
        }

        const childIds = new Set(kids.map((k) => k.id));
        const outstanding = await apiFetch<Outstanding[]>('/fees/outstanding').catch(() => []);
        setFees(
          outstanding.filter((d) => {
            const sid = d.enrollment?.student?.id ?? d.enrollment?.studentId;
            return Boolean(sid && childIds.has(sid));
          }),
        );

        const rates: Array<{ childName: string; percentage: number }> = [];
        for (const child of kids) {
          const enr = child.enrollments?.find((e) => e.session?.isCurrent) ?? child.enrollments?.[0];
          if (!enr) continue;
          try {
            const rate = await apiFetch<AttendanceRate>(`/attendance/rate?enrollmentId=${enr.id}`);
            rates.push({
              childName: `${child.firstName} ${child.lastName ?? ''}`.trim(),
              percentage: rate.percentage ?? 0,
            });
          } catch {
            // ignore missing rate
          }
        }
        setAttendance(rates);

        const exams = await apiFetch<Exam[]>('/exams').catch(() => []);
        const published = exams.filter((e) => (e.publications?.length ?? 0) > 0);
        const summaries: Array<{ examName: string; childName: string; percentage?: number; grade?: string }> = [];
        for (const exam of published.slice(0, 5)) {
          try {
            const results = await apiFetch<
              Array<{
                enrollmentId: string;
                student?: { firstName: string; lastName?: string | null };
                totals?: { percentage: number };
                grade?: { grade: string };
              }>
            >(`/exams/${exam.id}/results`);
            const enrollmentIds = new Set(
              kids.flatMap((c) => (c.enrollments ?? []).map((e) => e.id)),
            );
            for (const row of results) {
              if (!enrollmentIds.has(row.enrollmentId)) continue;
              summaries.push({
                examName: exam.name,
                childName: row.student
                  ? `${row.student.firstName} ${row.student.lastName ?? ''}`.trim()
                  : 'Child',
                percentage: row.totals?.percentage,
                grade: row.grade?.grade,
              });
            }
          } catch {
            // ignore unpublished / empty
          }
        }
        setExamSummaries(summaries);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load parent portal');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingState label="Loading parent portal…" />;
  if (error) return <ErrorAlert>{error}</ErrorAlert>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="My children" description="Linked students for this parent account" />
        <CardBody>
          <Table className="dense-table">
            <THead>
              <TR>
                <TH>Admission No</TH>
                <TH>Name</TH>
                <TH>Class</TH>
                <TH>Session</TH>
              </TR>
            </THead>
            <TBody>
              {children.map((c) => {
                const enr = c.enrollments?.find((e) => e.session?.isCurrent) ?? c.enrollments?.[0];
                return (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.admissionNo}</TD>
                    <TD>
                      {c.firstName} {c.lastName ?? ''}
                    </TD>
                    <TD>
                      {enr ? `${enr.section?.grade?.name ?? ''} ${enr.section?.name ?? ''}` : '—'}
                    </TD>
                    <TD>{enr?.session?.name ?? '—'}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {!children.length ? <EmptyState label="No linked children" /> : null}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Fees summary" />
          <CardBody>
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH>Due</TH>
                  <TH>Outstanding</TH>
                </TR>
              </THead>
              <TBody>
                {fees.map((f) => (
                  <TR key={f.id}>
                    <TD>{f.periodLabel}</TD>
                    <TD>{String(f.dueDate).slice(0, 10)}</TD>
                    <TD className="font-semibold text-amber-700">{formatInr(f.outstandingPaise)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!fees.length ? <EmptyState label="No outstanding fees" /> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Attendance" />
          <CardBody className="space-y-3">
            {attendance.map((a) => (
              <div key={a.childName} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
                <span className="text-sm text-slate-700">{a.childName}</span>
                <Badge tone={a.percentage >= 75 ? 'green' : 'amber'}>{a.percentage.toFixed(1)}%</Badge>
              </div>
            ))}
            {!attendance.length ? <EmptyState label="No attendance data" /> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Results" />
          <CardBody>
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Exam</TH>
                  <TH>Child</TH>
                  <TH>Grade</TH>
                </TR>
              </THead>
              <TBody>
                {examSummaries.map((r, idx) => (
                  <TR key={`${r.examName}-${r.childName}-${idx}`}>
                    <TD>{r.examName}</TD>
                    <TD>{r.childName}</TD>
                    <TD>
                      {r.grade ?? '—'}
                      {r.percentage != null ? ` (${r.percentage}%)` : ''}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!examSummaries.length ? <EmptyState label="No published results" /> : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Notices" description="Campus circulars" />
          <CardBody className="space-y-2">
            {notices.slice(0, 8).map((n) => (
              <div key={n.id} className="rounded-md border border-slate-100 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <Badge tone="indigo">{n.category}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{n.body}</p>
              </div>
            ))}
            {!notices.length ? <EmptyState label="No notices" /> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Homework" />
          <CardBody>
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Subject</TH>
                  <TH>Due</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {homework.slice(0, 10).map((hw) => (
                  <TR key={hw.id}>
                    <TD>{hw.title}</TD>
                    <TD>{hw.subject?.name ?? '—'}</TD>
                    <TD>{String(hw.dueDate).slice(0, 10)}</TD>
                    <TD>
                      <Badge>{hw.childCompletions?.[0]?.status ?? 'ASSIGNED'}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!homework.length ? <EmptyState label="No homework" /> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Class timetable" />
          <CardBody>
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Day</TH>
                  <TH>Period</TH>
                  <TH>Subject</TH>
                </TR>
              </THead>
              <TBody>
                {timetable.slice(0, 12).map((e) => (
                  <TR key={e.id}>
                    <TD>{DAY_LABELS[e.dayOfWeek] ?? e.dayOfWeek}</TD>
                    <TD>
                      {e.periodSlot?.label} ({e.periodSlot?.startTime}–{e.periodSlot?.endTime})
                    </TD>
                    <TD>{e.subject?.name}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!timetable.length ? <EmptyState label="No timetable" /> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
