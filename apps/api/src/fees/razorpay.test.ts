import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  capturedPaymentFromWebhook,
  hashCheckoutToken,
  isCheckoutToken,
  newCheckoutToken,
  verifyRazorpaySignature,
} from './razorpay.js';

describe('Razorpay webhook signature', () => {
  const secret = 'whsec_test_only';
  const body = JSON.stringify({ event: 'payment.captured' });

  it('accepts a signature over the raw body', () => {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpaySignature(body, signature, secret)).toBe(true);
  });

  it('rejects a tampered body, a bad signature, and a missing secret', () => {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpaySignature(`${body} `, signature, secret)).toBe(false);
    expect(verifyRazorpaySignature(body, `${signature.slice(0, -1)}a`, secret)).toBe(false);
    expect(verifyRazorpaySignature(body, signature, '')).toBe(false);
    expect(verifyRazorpaySignature(body, undefined, secret)).toBe(false);
  });
});

describe('Razorpay webhook payload', () => {
  it('reads a captured INR payment and ignores other events', () => {
    expect(
      capturedPaymentFromWebhook({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 5000, currency: 'INR', status: 'captured' } },
        },
      }),
    ).toEqual({ paymentId: 'pay_1', orderId: 'order_1', amountPaise: 5000 });
    expect(capturedPaymentFromWebhook({ event: 'payment.failed' })).toBeNull();
    expect(
      capturedPaymentFromWebhook({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 5000, currency: 'USD', status: 'captured' } },
        },
      }),
    ).toBeNull();
  });
});

describe('checkout token', () => {
  it('is 64 hex characters and hashes stably', () => {
    const issued = newCheckoutToken();
    expect(isCheckoutToken(issued.token)).toBe(true);
    expect(issued.hash).toBe(hashCheckoutToken(issued.token));
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
