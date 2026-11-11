'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { formatInr } from '@/lib/utils';

type CheckoutState = {
  status: string;
  amountPaise: number;
  currency: string;
  campusName: string;
  keyId?: string;
  razorpayOrderId?: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function CheckoutPanel() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<CheckoutState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError('This payment link is not valid.');
      return;
    }
    try {
      const next = await apiFetch<CheckoutState>(`/fees/checkout/${token}`, { auth: false });
      setState(next);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Checkout could not be loaded');
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  function openCheckout() {
    if (!state?.keyId || !state.razorpayOrderId || !window.Razorpay) return;
    const checkout = new window.Razorpay({
      key: state.keyId,
      amount: state.amountPaise,
      currency: 'INR',
      name: state.campusName,
      order_id: state.razorpayOrderId,
      handler: () => {
        void load();
      },
    });
    checkout.open();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setReady(true)} />
      <h1 className="text-2xl font-semibold text-slate-900">School fee payment</h1>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {state ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">{state.campusName}</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{formatInr(state.amountPaise)}</p>
          <p className="mt-2 text-sm text-slate-600">
            {state.status === 'PAID'
              ? 'Razorpay confirmed this payment. The school receipt is recorded.'
              : state.status === 'EXPIRED'
                ? 'This link has expired. Start the payment again from Fees.'
                : state.status === 'FAILED'
                  ? 'This payment was not recorded. Start again from Fees.'
                  : 'The receipt is recorded only after Razorpay confirms the payment.'}
          </p>
          {state.status === 'CREATED' ? (
            <button
              type="button"
              className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={!ready || !state.keyId}
              onClick={openCheckout}
            >
              Pay {formatInr(state.amountPaise)}
            </button>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Loading checkout…</main>}>
      <CheckoutPanel />
    </Suspense>
  );
}
