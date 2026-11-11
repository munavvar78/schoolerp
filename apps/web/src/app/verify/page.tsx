'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectPanel() {
  const router = useRouter();
  const code = useSearchParams().get('code');

  useEffect(() => {
    const next = code ? `/verify-certificate?code=${encodeURIComponent(code)}` : '/verify-certificate';
    router.replace(next);
  }, [code, router]);

  return <main className="p-8 text-sm text-slate-600">Opening certificate check…</main>;
}

export default function VerifyRedirectPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Opening certificate check…</main>}>
      <RedirectPanel />
    </Suspense>
  );
}
