'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CERTIFICATE_TYPES, type CertificateType, type Role } from '@school-erp/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type CertificateRow = {
  id: string;
  type: CertificateType;
  serialNo: string;
  purpose: string;
  verificationCode: string;
  issuedAt: string;
  revokedAt?: string | null;
  student?: { firstName: string; lastName?: string | null; admissionNo: string };
};

type StudentRow = { id: string; firstName: string; lastName?: string | null; admissionNo: string };

const ISSUE_ROLES = new Set<Role>(['ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT', 'PLATFORM_OPERATOR']);

export default function CertificatesPage() {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    setRole(getSession()?.role ?? null);
  }, []);
  const canIssue = role ? ISSUE_ROLES.has(role) : false;
  const accountant = role === 'ACCOUNTANT';
  const canRevoke = role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN' || role === 'PLATFORM_OPERATOR';
  const types = accountant ? (['FEE_CLEARANCE'] as const) : CERTIFICATE_TYPES;
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [type, setType] = useState<CertificateType>(accountant ? 'FEE_CLEARANCE' : 'BONAFIDE');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, people] = await Promise.all([
        apiFetch<CertificateRow[]>('/certificates'),
        canIssue ? apiFetch<StudentRow[]>('/students') : Promise.resolve([]),
      ]);
      setRows(list);
      setStudents(people);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [canIssue]);

  useEffect(() => {
    void load();
  }, [load]);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOk(null);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const created = await apiFetch<CertificateRow>('/certificates', {
        method: 'POST',
        json: {
          studentId: String(data.get('studentId') || ''),
          type,
          purpose: String(data.get('purpose') || ''),
          conduct: String(data.get('conduct') || '') || undefined,
          reason: String(data.get('reason') || '') || undefined,
          leavingDate: String(data.get('leavingDate') || '') || undefined,
        },
      });
      form.reset();
      setOk(`Issued ${created.serialNo}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not issue the certificate');
    }
  }

  async function revoke(id: string) {
    setOk(null);
    setError(null);
    try {
      await apiFetch(`/certificates/${id}/revoke`, { method: 'POST' });
      setOk('Certificate revoked');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke the certificate');
    }
  }

  if (loading) return <LoadingState label="Loading certificates…" />;

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
      <Card>
        <CardHeader title="Issued certificates" description="Verification shows the name initial only" />
        <CardBody>
          <Table className="dense-table">
            <THead>
              <TR>
                <TH>Serial</TH>
                <TH>Student</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH className="no-print">Check</TH>
                {canRevoke ? <TH className="no-print">Action</TH> : null}
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => {
                const student = row.student;
                return (
                  <TR key={row.id}>
                    <TD>{row.serialNo}</TD>
                    <TD>
                      {student
                        ? `${student.admissionNo} — ${student.firstName} ${student.lastName ?? ''}`
                        : '—'}
                    </TD>
                    <TD>{row.type}</TD>
                    <TD>
                      <Badge>{row.revokedAt ? 'REVOKED' : 'VALID'}</Badge>
                    </TD>
                    <TD className="no-print">
                      <a className="text-brand-700 underline" href={`/verify-certificate?code=${row.verificationCode}`}>
                        Open
                      </a>
                    </TD>
                    {canRevoke ? (
                      <TD className="no-print">
                        {row.revokedAt ? null : (
                          <Button size="sm" variant="outline" onClick={() => void revoke(row.id)}>
                            Revoke
                          </Button>
                        )}
                      </TD>
                    ) : null}
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {!rows.length ? <EmptyState label="No certificates yet" /> : null}
        </CardBody>
      </Card>

      {canIssue ? (
        <Card>
          <CardHeader title="Issue a certificate" />
          <CardBody>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={issue}>
              <Select name="studentId" label="Student" required defaultValue="">
                <option value="">Select</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.admissionNo} — {student.firstName} {student.lastName ?? ''}
                  </option>
                ))}
              </Select>
              <Select
                label="Type"
                value={type}
                onChange={(event) => setType(event.target.value as CertificateType)}
              >
                {types.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
              <Textarea name="purpose" label="Purpose" required className="sm:col-span-2" />
              {type === 'TRANSFER' ? (
                <>
                  <Input name="leavingDate" label="Date of leaving" type="date" required />
                  <Input name="reason" label="Reason" required />
                </>
              ) : null}
              {type === 'CHARACTER' || type === 'TRANSFER' ? (
                <Input name="conduct" label="Conduct" />
              ) : null}
              <div className="flex items-end">
                <Button type="submit">Issue</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
