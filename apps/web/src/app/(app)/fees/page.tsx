'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FEE_CYCLES, PAYMENT_METHODS } from '@school-erp/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { formatInr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type FeeHead = {
  id: string;
  name: string;
  code: string;
  cycle: string;
  gstTreatment?: string;
  gstRateBps?: number;
};
type GstProfile = { legalName: string; gstin: string; stateCode: string; address?: string | null } | null;
type Invoice = {
  id: string;
  invoiceNo: string;
  totalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  exemptPaise: number;
  supply: string;
  payment?: { receiptNo?: string };
};
type FeeStructure = {
  id: string;
  name: string;
  grade?: { name: string };
  session?: { name: string };
  lines: Array<{ amountPaise: number; feeHead?: { name: string } }>;
};
type Outstanding = {
  id: string;
  periodLabel: string;
  dueDate: string;
  totalPaise: number;
  concessionPaise: number;
  paidPaise: number;
  lateFeePaise: number;
  outstandingPaise: number;
  enrollment?: {
    student?: { firstName: string; lastName?: string | null; admissionNo: string };
  };
};
type Grade = { id: string; name: string };
type Session = { id: string; name: string; isCurrent: boolean };

export default function FeesPage() {
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [outstanding, setOutstanding] = useState<Outstanding[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [payDemandId, setPayDemandId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<(typeof PAYMENT_METHODS)[number]>('UPI');
  const [profile, setProfile] = useState<GstProfile>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [canRecord, setCanRecord] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const role = getSession()?.role;
      const record = role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN' || role === 'ACCOUNTANT';
      const [h, st, o, g, s, gst, inv] = await Promise.all([
        record ? apiFetch<FeeHead[]>('/fees/heads') : Promise.resolve([]),
        record ? apiFetch<FeeStructure[]>('/fees/structures') : Promise.resolve([]),
        apiFetch<Outstanding[]>('/fees/outstanding'),
        record ? apiFetch<Grade[]>('/academic/grades') : Promise.resolve([]),
        record ? apiFetch<Session[]>('/academic/sessions') : Promise.resolve([]),
        record ? apiFetch<GstProfile>('/fees/gst-profile') : Promise.resolve(null),
        apiFetch<Invoice[]>('/fees/invoices'),
      ]);
      setHeads(h);
      setStructures(st);
      setOutstanding(o.filter((d) => d.outstandingPaise > 0));
      setGrades(g);
      setSessions(s);
      setProfile(gst);
      setInvoices(inv);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load fees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const role = getSession()?.role;
    setCanRecord(role === 'ORG_OWNER' || role === 'CAMPUS_ADMIN' || role === 'ACCOUNTANT');
    void load();
  }, [load]);

  async function createHead(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/fees/heads', {
        method: 'POST',
        json: {
          name: String(fd.get('name') || ''),
          code: String(fd.get('code') || ''),
          cycle: String(fd.get('cycle') || 'MONTHLY'),
          gstTreatment: String(fd.get('gstTreatment') || 'EXEMPT'),
          gstRateBps:
            String(fd.get('gstTreatment') || 'EXEMPT') === 'TAXABLE'
              ? Number(fd.get('gstRateBps') || 0)
              : 0,
        },
      });
      setOk('Fee head created');
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create fee head');
    }
  }

  async function createStructure(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const feeHeadId = String(fd.get('feeHeadId') || '');
    const amountRupees = Number(fd.get('amountRupees') || 0);
    try {
      await apiFetch('/fees/structures', {
        method: 'POST',
        json: {
          name: String(fd.get('name') || ''),
          gradeId: String(fd.get('gradeId') || ''),
          sessionId: String(fd.get('sessionId') || ''),
          lines: [{ feeHeadId, amountPaise: Math.round(amountRupees * 100) }],
        },
      });
      setOk('Fee structure created');
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create structure');
    }
  }

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!payDemandId) return;
    try {
      await apiFetch('/fees/payments', {
        method: 'POST',
        json: {
          feeDemandId: payDemandId,
          amountPaise: Math.round(Number(payAmount) * 100),
          method: payMethod,
        },
      });
      setOk('Payment recorded');
      setPayDemandId(null);
      setPayAmount('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Payment failed');
    }
  }

  if (loading) return <LoadingState label="Loading fees…" />;

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}

      {canRecord ? (
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Fee heads" />
          <CardBody>
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Name</TH>
                  <TH>Cycle</TH>
                  <TH>GST</TH>
                </TR>
              </THead>
              <TBody>
                {heads.map((h) => (
                  <TR key={h.id}>
                    <TD>{h.code}</TD>
                    <TD>{h.name}</TD>
                    <TD>
                      <Badge>{h.cycle}</Badge>
                    </TD>
                    <TD>
                      {h.gstTreatment === 'TAXABLE' ? `GST ${((h.gstRateBps ?? 0) / 100).toFixed(0)}%` : 'Exempt'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!heads.length ? <EmptyState label="No fee heads" /> : null}
            {canRecord ? (
            <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4 no-print" onSubmit={createHead}>
              <Input name="name" label="Name" required placeholder="Tuition" />
              <Input name="code" label="Code" required placeholder="TUIT" />
              <Select name="cycle" label="Cycle" defaultValue="MONTHLY">
                {FEE_CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select name="gstTreatment" label="GST" defaultValue="EXEMPT">
                <option value="EXEMPT">Exempt</option>
                <option value="TAXABLE">Taxable</option>
              </Select>
              <Select name="gstRateBps" label="Rate if taxable" defaultValue="0">
                <option value="0">0%</option>
                <option value="500">5%</option>
                <option value="1200">12%</option>
                <option value="1800">18%</option>
                <option value="2800">28%</option>
              </Select>
              <div className="flex items-end">
                <Button type="submit">Add head</Button>
              </div>
            </form>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Fee structures" />
          <CardBody>
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Grade / Session</TH>
                  <TH>Lines</TH>
                </TR>
              </THead>
              <TBody>
                {structures.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.name}</TD>
                    <TD>
                      {s.grade?.name ?? '—'} · {s.session?.name ?? '—'}
                    </TD>
                    <TD>
                      {s.lines
                        .map((l) => `${l.feeHead?.name ?? 'Head'} ${formatInr(l.amountPaise)}`)
                        .join(', ')}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {canRecord ? (
            <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 no-print" onSubmit={createStructure}>
              <Input name="name" label="Structure name" required />
              <Select name="gradeId" label="Grade" required defaultValue="">
                <option value="">Select</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
              <Select name="sessionId" label="Session" required defaultValue={sessions.find((s) => s.isCurrent)?.id ?? ''}>
                <option value="">Select</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select name="feeHeadId" label="Fee head" required defaultValue="">
                <option value="">Select</option>
                {heads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
              <Input name="amountRupees" label="Amount (₹)" type="number" step="0.01" required />
              <div className="flex items-end">
                <Button type="submit">Add structure</Button>
              </div>
            </form>
            ) : null}
          </CardBody>
        </Card>
      </div>
      ) : null}

      <Card>
        <CardHeader
          title="Outstanding dues"
          description={canRecord ? 'Record payments against open demands' : 'What is still due'}
        />
        <CardBody>
          <Table className="dense-table">
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>Period</TH>
                <TH>Due</TH>
                <TH>Total</TH>
                <TH>Paid</TH>
                <TH>Late</TH>
                <TH>Outstanding</TH>
                <TH className="no-print">Action</TH>
              </TR>
            </THead>
            <TBody>
              {outstanding.map((d) => {
                const st = d.enrollment?.student;
                return (
                  <TR key={d.id}>
                    <TD>
                      {st ? `${st.admissionNo} — ${st.firstName} ${st.lastName ?? ''}` : d.id}
                    </TD>
                    <TD>{d.periodLabel}</TD>
                    <TD>{String(d.dueDate).slice(0, 10)}</TD>
                    <TD>{formatInr(d.totalPaise - d.concessionPaise)}</TD>
                    <TD>{formatInr(d.paidPaise)}</TD>
                    <TD>{formatInr(d.lateFeePaise)}</TD>
                    <TD className="font-semibold text-amber-700">{formatInr(d.outstandingPaise)}</TD>
                    <TD className="no-print">
                      <div className="flex gap-2">
                        {canRecord ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPayDemandId(d.id);
                              setPayAmount(String((d.outstandingPaise / 100).toFixed(2)));
                            }}
                          >
                            Pay
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          onClick={() => {
                            void apiFetch<{ checkoutPath: string }>('/fees/orders', {
                              method: 'POST',
                              json: { feeDemandId: d.id, amountPaise: d.outstandingPaise },
                            })
                              .then((order) => {
                                window.location.href = order.checkoutPath;
                              })
                              .catch((err) => {
                                setError(err instanceof ApiError ? err.message : 'Online payment failed');
                              });
                          }}
                        >
                          Pay online
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {!outstanding.length ? <EmptyState label="No outstanding dues" /> : null}

          {canRecord && payDemandId ? (
            <form className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-brand-100 bg-brand-50/40 p-3 no-print" onSubmit={recordPayment}>
              <Input
                label="Amount (₹)"
                type="number"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
              <Select
                label="Method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <Button type="submit">Record payment</Button>
              <Button type="button" variant="ghost" onClick={() => setPayDemandId(null)}>
                Cancel
              </Button>
            </form>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {canRecord ? (
        <Card>
          <CardHeader
            title="GST profile"
            description={profile ? `${profile.legalName} · ${profile.gstin}` : 'Required before taxable invoices'}
          />
          <CardBody>
            {canRecord ? (
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  try {
                    await apiFetch('/fees/gst-profile', {
                      method: 'POST',
                      json: {
                        legalName: String(fd.get('legalName') || ''),
                        gstin: String(fd.get('gstin') || ''),
                        address: String(fd.get('address') || '') || undefined,
                      },
                    });
                    setOk('GST profile saved');
                    await load();
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : 'Could not save GST profile');
                  }
                }}
              >
                <Input name="legalName" label="Legal name" required defaultValue={profile?.legalName ?? ''} />
                <Input name="gstin" label="GSTIN" required defaultValue={profile?.gstin ?? ''} maxLength={15} />
                <Input name="address" label="Address" defaultValue={profile?.address ?? ''} />
                <div className="flex items-end">
                  <Button type="submit">Save GST profile</Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-slate-600">
                {profile ? `Invoices use ${profile.gstin} (${profile.stateCode}).` : 'The school has not saved a GSTIN yet.'}
              </p>
            )}
          </CardBody>
        </Card>
        ) : null}
        <Card>
          <CardHeader title="Tax invoices" description="Issued from recorded payments" />
          <CardBody>
            <Table className="dense-table">
              <THead>
                <TR>
                  <TH>Invoice</TH>
                  <TH>Supply</TH>
                  <TH>Tax</TH>
                  <TH>Total</TH>
                </TR>
              </THead>
              <TBody>
                {invoices.map((invoice) => (
                  <TR key={invoice.id}>
                    <TD>{invoice.invoiceNo}</TD>
                    <TD>{invoice.supply === 'INTER_STATE' ? 'IGST' : 'CGST + SGST'}</TD>
                    <TD>{formatInr(invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise)}</TD>
                    <TD>{formatInr(invoice.totalPaise)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!invoices.length ? <EmptyState label="No invoices yet" /> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
