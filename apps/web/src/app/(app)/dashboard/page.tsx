'use client';

import { FormEvent, useEffect, useState } from 'react';
import { isModuleEnabled } from '@school-erp/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ApiError, apiFetch } from '@/lib/api';
import { getSession } from '@/lib/session';
import { formatInr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { ErrorAlert, LoadingState } from '@/components/ui/alert';

type Overview = {
  studentCount: number;
  sectionCount: number;
  attendanceTrend: Array<{ date: string; percentage: number }>;
  feeSummary: { demandTotal: number; collected: number; outstanding: number; count: number };
  subjectAverages: Array<{ subject: string; average: number }>;
  openApplications?: number;
  unpublishedNotices?: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('What is our fee outstanding and recent attendance?');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [canAsk, setCanAsk] = useState(false);
  const [family, setFamily] = useState(false);
  const [showFees, setShowFees] = useState(false);

  useEffect(() => {
    const session = getSession();
    const role = session?.role;
    setFamily(role === 'PARENT' || role === 'STUDENT');
    setCanAsk(session ? isModuleEnabled(session.role, 'ai', session.enabledModules) : false);
    setShowFees(session ? isModuleEnabled(session.role, 'fees', session.enabledModules) : false);
    let cancelled = false;
    (async () => {
      try {
        const overview = await apiFetch<Overview>('/dashboard/overview');
        if (!cancelled) setData(overview);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function askAi(e: FormEvent) {
    e.preventDefault();
    setAsking(true);
    setAnswer(null);
    try {
      const res = await apiFetch<{ answer: string }>('/ai/ask', {
        method: 'POST',
        json: { question },
      });
      setAnswer(res.answer);
    } catch (err) {
      setAnswer(err instanceof ApiError ? err.message : 'AI request failed');
    } finally {
      setAsking(false);
    }
  }

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorAlert>{error}</ErrorAlert>;
  if (!data) return null;

  const feeChart = [
    { name: 'Demand', amount: data.feeSummary.demandTotal / 100 },
    { name: 'Collected', amount: data.feeSummary.collected / 100 },
    { name: 'Outstanding', amount: data.feeSummary.outstanding / 100 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {family ? 'Linked students' : 'Student strength'}
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{data.studentCount}</p>
            <p className="mt-1 text-xs text-slate-500">
              {family ? `${data.sectionCount} classes` : `${data.sectionCount} sections`}
            </p>
          </CardBody>
        </Card>
        {family ? null : (
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open applications</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{data.openApplications ?? 0}</p>
          </CardBody>
        </Card>
        )}
        {family ? null : (
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Draft notices</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{data.unpublishedNotices ?? 0}</p>
          </CardBody>
        </Card>
        )}
        {showFees ? (
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fee demand</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatInr(data.feeSummary.demandTotal)}</p>
          </CardBody>
        </Card>
        ) : null}
        {showFees ? (
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Collected</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatInr(data.feeSummary.collected)}</p>
          </CardBody>
        </Card>
        ) : null}
        {showFees ? (
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">{formatInr(data.feeSummary.outstanding)}</p>
          </CardBody>
        </Card>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Attendance trend"
            description={family ? 'Present % for linked students' : 'Campus daily present %'}
          />
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="percentage" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {showFees ? (
        <Card>
          <CardHeader
            title="Fee collection vs demand"
            description={family ? 'Linked students, amounts in INR' : 'Amounts in INR'}
          />
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Subject averages"
            description={family ? 'Published exam averages for linked students' : 'Weighted exam averages %'}
          />
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.subjectAverages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="average" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {canAsk ? (
        <Card>
          <CardHeader title="Ask AI" description="Campus-aware copilot backed by live ERP facts" />
          <CardBody>
            <form className="space-y-3" onSubmit={askAi}>
              <Textarea
                label="Question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                minLength={3}
                required
              />
              <Button type="submit" disabled={asking}>
                {asking ? 'Asking…' : 'Ask'}
              </Button>
            </form>
            {answer ? (
              <pre className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                {answer}
              </pre>
            ) : null}
          </CardBody>
        </Card>
        ) : null}
      </div>
    </div>
  );
}
