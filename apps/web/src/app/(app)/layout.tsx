'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SessionExpiryGuard } from '@/components/session-expiry-guard';
import { LoadingState } from '@/components/ui/alert';
import { getAccessToken, getSession, redirectToLogin, type SessionPayload } from '@/lib/session';
import { isAccessTokenExpired } from '@/lib/token';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = getSession();
    const token = getAccessToken();
    if (!current?.accessToken || !token || isAccessTokenExpired(token)) {
      redirectToLogin('session_expired');
      return;
    }
    setSession(current);
    setReady(true);
  }, [router]);

  const onSessionRefreshed = useCallback((next: SessionPayload) => {
    setSession(next);
  }, []);

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  return (
    <>
      <SessionExpiryGuard session={session} onSessionRefreshed={onSessionRefreshed} />
      <AppShell session={session}>{children}</AppShell>
    </>
  );
}
