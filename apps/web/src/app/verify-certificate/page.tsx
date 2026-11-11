'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';

type PublicCertificate = {
  valid: boolean;
  status: string;
  type: string;
  serialNo: string;
  issuedAt: string;
  studentName: string;
  campusName: string;
};

function VerifyPanel() {
  const code = useSearchParams().get('code') ?? '';
  const [row, setRow] = useState<PublicCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(code)) {
      setError('This verification code is not valid.');
      return;
    }
    let cancelled = false;
    apiFetch<PublicCertificate>(`/certificates/verify/${code}`, { auth: false })
      .then((next) => {
        if (!cancelled) setRow(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Certificate not found');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold text-slate-900">Certificate check</h1>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {row ? (
        <dl className="mt-6 space-y-2 text-sm text-slate-700">
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium">{row.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Serial</dt>
            <dd>{row.serialNo}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Type</dt>
            <dd>{row.type}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Student</dt>
            <dd>{row.studentName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Campus</dt>
            <dd>{row.campusName}</dd>
          </div>
        </dl>
      ) : null}
    </main>
  );
}

export default function VerifyCertificatePage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Checking certificate…</main>}>
      <VerifyPanel />
    </Suspense>
  );
}
