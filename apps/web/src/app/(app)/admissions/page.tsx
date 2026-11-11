'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { formatInr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Grade = { id: string; name: string; sections: Array<{ id: string; name: string }> };
type Session = { id: string; name: string; isCurrent: boolean };
type Application = {
  id: string;
  firstName: string;
  lastName?: string | null;
  status: string;
  contactName: string;
  contactPhone?: string | null;
  admissionFeePaise: number;
  admissionFeePaidPaise: number;
  grade?: { id: string; name: string };
  session?: { id: string; name: string };
  studentId?: string | null;
};

const NEXT: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WAITLISTED', 'OFFERED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['WAITLISTED', 'OFFERED', 'REJECTED', 'WITHDRAWN'],
  WAITLISTED: ['UNDER_REVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN'],
  OFFERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
};

export default function AdmissionsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [convertAppId, setConvertAppId] = useState('');
  const [convertSectionId, setConvertSectionId] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [canRecordFee, setCanRecordFee] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const role = getSession()?.role;
      const manage = role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN';
      if (!manage) {
        setApps(await apiFetch<Application[]>('/admissions'));
        return;
      }
      const [list, g, s] = await Promise.all([
        apiFetch<Application[]>('/admissions'),
        apiFetch<Grade[]>('/academic/grades'),
        apiFetch<Session[]>('/academic/sessions'),
      ]);
      setApps(list);
      setGrades(g);
      setSessions(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load admissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const role = getSession()?.role;
    const manage = role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN';
    setCanManage(manage);
    setCanRecordFee(manage || role === 'ACCOUNTANT');
    void load();
  }, [load]);

  const currentSession = useMemo(
    () => sessions.find((s) => s.isCurrent) ?? sessions[0],
    [sessions],
  );

  const convertApp = apps.find((a) => a.id === convertAppId);
  const convertSections =
    grades.find((g) => g.id === convertApp?.grade?.id)?.sections ??
    grades.flatMap((g) => g.sections);

  async function createApp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await apiFetch('/admissions', {
        method: 'POST',
        json: {
          sessionId: String(fd.get('sessionId') || ''),
          gradeId: String(fd.get('gradeId') || ''),
          firstName: String(fd.get('firstName') || ''),
          lastName: String(fd.get('lastName') || '') || undefined,
          contactName: String(fd.get('contactName') || ''),
          contactPhone: String(fd.get('contactPhone') || '') || undefined,
          contactEmail: String(fd.get('contactEmail') || '') || undefined,
          submit: true,
        },
      });
      form.reset();
      await load();
      setOk('Application submitted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  }

  async function transition(applicationId: string, status: string) {
    setOk(null);
    setError(null);
    try {
      await apiFetch('/admissions/transition', {
        method: 'POST',
        json: { applicationId, status },
      });
      setOk(`Moved to ${status}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transition failed');
    }
  }

  async function recordFee(applicationId: string, amountPaise: number) {
    setOk(null);
    setError(null);
    try {
      await apiFetch('/admissions/fee', {
        method: 'POST',
        json: { applicationId, amountPaise, method: 'UPI' },
      });
      setOk('Admission fee recorded');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fee failed');
    }
  }

  async function convert(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);
    try {
      await apiFetch('/admissions/convert', {
        method: 'POST',
        json: {
          applicationId: convertAppId,
          sectionId: convertSectionId,
        },
      });
      setOk('Converted to enrolled student');
      setConvertAppId('');
      setConvertSectionId('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Convert failed');
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      {canManage ? (
      <Card>
        <CardHeader title="New application" description="Enquiry → review → offer → enroll" />
        <CardBody>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={createApp}>
            <Select name="sessionId" label="Session" required defaultValue={currentSession?.id}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select name="gradeId" label="Grade" required>
              <option value="">Select grade</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Input name="firstName" label="Applicant first name" required />
            <Input name="lastName" label="Last name" />
            <Input name="contactName" label="Contact name" required />
            <Input name="contactPhone" label="Contact phone" />
            <Input name="contactEmail" label="Contact email" type="email" />
            <div className="flex items-end">
              <Button type="submit">Submit application</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      ) : null}

      {canManage ? (
      <Card>
        <CardHeader title="Convert to student" description="After offer/accept + fee" />
        <CardBody>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={convert}>
            <Select
              label="Application"
              value={convertAppId}
              onChange={(e) => setConvertAppId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {apps
                .filter((a) => ['OFFERED', 'ACCEPTED'].includes(a.status) && !a.studentId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName ?? ''} ({a.status})
                  </option>
                ))}
            </Select>
            <Select
              label="Section"
              value={convertSectionId}
              onChange={(e) => setConvertSectionId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {convertSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <div className="flex items-end">
              <Button type="submit">Convert & enroll</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      ) : null}

      <Card>
        <CardHeader title="Pipeline" description={`${apps.length} applications`} />
        <CardBody className="p-0">
          {loading ? (
            <LoadingState label="Loading…" />
          ) : apps.length === 0 ? (
            <EmptyState label="No applications" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Applicant</TH>
                  <TH>Grade</TH>
                  <TH>Status</TH>
                  <TH>Fee</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {apps.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <div className="font-medium">
                        {a.firstName} {a.lastName ?? ''}
                      </div>
                      <div className="text-xs text-slate-500">{a.contactName}</div>
                    </TD>
                    <TD>{a.grade?.name}</TD>
                    <TD>
                      <Badge>{a.status}</Badge>
                    </TD>
                    <TD>
                      {formatInr(a.admissionFeePaidPaise)} / {formatInr(a.admissionFeePaise)}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {canManage
                          ? (NEXT[a.status] ?? []).map((status) => (
                          <Button
                            key={status}
                            type="button"
                            variant="outline"
                            onClick={() => void transition(a.id, status)}
                          >
                            {status}
                          </Button>
                        ))
                          : null}
                        {canRecordFee && ['OFFERED', 'ACCEPTED'].includes(a.status) &&
                        a.admissionFeePaidPaise < a.admissionFeePaise ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              void recordFee(
                                a.id,
                                Math.max(0, a.admissionFeePaise - a.admissionFeePaidPaise) || 250000,
                              )
                            }
                          >
                            Record fee
                          </Button>
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
