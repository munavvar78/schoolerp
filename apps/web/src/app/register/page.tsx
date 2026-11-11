'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOARDS } from '@school-erp/shared';
import { ApiError, register } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { ErrorAlert } from '@/components/ui/alert';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    organizationName: '',
    campusName: '',
    board: 'CBSE' as (typeof BOARDS)[number],
    ownerName: '',
    email: '',
    password: '',
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(form);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-brand-900 to-slate-800 px-4 py-10">
      <Card className="relative z-10 w-full max-w-xl">
        <CardHeader title="Register organization" description="Create your school campus and owner account" />
        <CardBody>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <Input
              label="Organization name"
              required
              value={form.organizationName}
              onChange={(e) => update('organizationName', e.target.value)}
            />
            <Input
              label="Campus name"
              required
              value={form.campusName}
              onChange={(e) => update('campusName', e.target.value)}
            />
            <Select
              label="Board"
              value={form.board}
              onChange={(e) => update('board', e.target.value as (typeof BOARDS)[number])}
            >
              {BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
            <Input
              label="Owner name"
              required
              value={form.ownerName}
              onChange={(e) => update('ownerName', e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
            {error ? (
              <div className="sm:col-span-2">
                <ErrorAlert>{error}</ErrorAlert>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating…' : 'Create organization'}
              </Button>
            </div>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            Already registered?{' '}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
