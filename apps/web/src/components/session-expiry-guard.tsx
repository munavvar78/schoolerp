'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshSession } from '@/lib/api';
import { getAccessToken, getSession, redirectToLogin, type SessionPayload } from '@/lib/session';
import {
  getAccessTokenExpiresAt,
  isAccessTokenExpired,
  msUntilExpiryWarning,
} from '@/lib/token';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

const WARN_BEFORE_MS = 2 * 60 * 1000;

export function SessionExpiryGuard({
  session,
  onSessionRefreshed,
}: {
  session: SessionPayload;
  onSessionRefreshed?: (next: SessionPayload) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warnedForExp = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const schedule = useCallback(() => {
    clearTimer();
    const token = getAccessToken() ?? session.accessToken;
    if (!token) {
      redirectToLogin('session_expired');
      return;
    }

    if (isAccessTokenExpired(token)) {
      redirectToLogin('session_expired');
      return;
    }

    const expiresAt = getAccessTokenExpiresAt(token);
    const untilWarn = msUntilExpiryWarning(token, WARN_BEFORE_MS);
    if (expiresAt == null || untilWarn == null) return;

    // Already inside the 2-minute window — show immediately once per expiry.
    if (untilWarn <= 0) {
      if (warnedForExp.current !== expiresAt) {
        warnedForExp.current = expiresAt;
        setOpen(true);
      }
      // Also force logout exactly at expiry if user ignores the dialog.
      const untilExpiry = expiresAt - Date.now();
      timerRef.current = setTimeout(() => {
        redirectToLogin('session_expired');
      }, Math.max(untilExpiry, 0));
      return;
    }

    timerRef.current = setTimeout(() => {
      const latest = getAccessToken() ?? session.accessToken;
      const exp = latest ? getAccessTokenExpiresAt(latest) : null;
      if (!latest || !exp || isAccessTokenExpired(latest)) {
        redirectToLogin('session_expired');
        return;
      }
      warnedForExp.current = exp;
      setOpen(true);
      const remaining = exp - Date.now();
      timerRef.current = setTimeout(() => {
        redirectToLogin('session_expired');
      }, Math.max(remaining, 0));
    }, untilWarn);
  }, [session.accessToken]);

  useEffect(() => {
    schedule();
    return clearTimer;
  }, [schedule, session.accessToken, session.expiresAt]);

  async function onYes() {
    setBusy(true);
    setError(null);
    try {
      const next = await refreshSession();
      setOpen(false);
      warnedForExp.current = null;
      onSessionRefreshed?.(next);
      // Reschedule against the new token.
      schedule();
    } catch {
      setError('Could not refresh session. You will be signed out.');
      setTimeout(() => redirectToLogin('session_expired'), 1200);
    } finally {
      setBusy(false);
    }
  }

  function onNo() {
    setOpen(false);
    clearTimer();
    void (async () => {
      redirectToLogin('session_ended');
    })();
  }

  // Keep dialog in sync if another tab refreshed localStorage.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== 'erp_session' && e.key !== 'erp_access') return;
      const current = getSession();
      if (!current?.accessToken) {
        redirectToLogin('session_expired');
        return;
      }
      onSessionRefreshed?.(current);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [onSessionRefreshed]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expiry-title"
    >
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader
          title="Session expiring soon"
          description="Your login will expire in about 2 minutes."
        />
        <CardBody className="space-y-4">
          <p id="session-expiry-title" className="text-sm text-slate-700">
            Do you want to refresh your session and stay signed in?
          </p>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onNo} disabled={busy}>
              No
            </Button>
            <Button onClick={onYes} disabled={busy}>
              {busy ? 'Refreshing…' : 'Yes'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
