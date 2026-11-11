'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorAlert, LoadingState } from '@/components/ui/alert';
import { GraduationCap } from '@/lib/nav';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('admin@bharatvidya.edu');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const notice = useMemo(() => {
    const reason = searchParams.get('reason');
    if (reason === 'session_expired') {
      return 'Your session expired or the token was invalid. Please sign in again.';
    }
    if (reason === 'session_ended') {
      return 'You chose not to refresh. Please sign in again.';
    }
    return null;
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-md border-slate-200/80">
      <CardHeader
        title="Sign in"
        description="Access your campus ERP workspace"
        actions={<GraduationCap className="h-5 w-5 text-brand-600" />}
      />
      <CardBody>
        {notice ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {notice}
          </p>
        ) : null}
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <ErrorAlert>{error}</ErrorAlert> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Demo: <span className="font-medium">admin@bharatvidya.edu</span> /{' '}
          <span className="font-medium">Password123!</span>
        </p>
        <p className="mt-4 text-center text-sm text-slate-600">
          New school?{' '}
          <Link href="/register" className="font-medium text-brand-700 hover:underline">
            Register organization
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-brand-900 to-slate-800 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.25),transparent_45%)]" />
      <Suspense fallback={<LoadingState label="Loading sign-in…" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
