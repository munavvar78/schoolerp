import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const CHECKOUT_TTL_MS = 30 * 60 * 1000;

export function checkoutTtlMs(): number {
  return CHECKOUT_TTL_MS;
}

export function newCheckoutToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    hash: hashCheckoutToken(token),
    expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
  };
}

export function hashCheckoutToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isCheckoutToken(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

/** Razorpay signs the raw request body with HMAC-SHA256 (hex). */
export function verifyRazorpaySignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual = signature.trim();
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(actual, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export interface CapturedRazorpayPayment {
  paymentId: string;
  orderId: string;
  amountPaise: number;
}

/** Accept only a captured INR payment. Other events are ignored by the caller. */
export function capturedPaymentFromWebhook(body: unknown): CapturedRazorpayPayment | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as { event?: unknown; payload?: { payment?: { entity?: unknown } } };
  if (record.event !== 'payment.captured') return null;
  const entity = record.payload?.payment?.entity;
  if (!entity || typeof entity !== 'object') return null;
  const payment = entity as Record<string, unknown>;
  if (typeof payment.id !== 'string' || typeof payment.order_id !== 'string') return null;
  if (typeof payment.amount !== 'number' || !Number.isInteger(payment.amount) || payment.amount <= 0) {
    return null;
  }
  if (payment.status !== 'captured' || payment.currency !== 'INR') return null;
  return { paymentId: payment.id, orderId: payment.order_id, amountPaise: payment.amount };
}

export async function createRazorpayOrder(input: {
  keyId: string;
  keySecret: string;
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<{ id: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const auth = Buffer.from(`${input.keyId}:${input.keySecret}`).toString('base64');
  const response = await fetchImpl('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const description =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      data.error &&
      typeof data.error === 'object' &&
      'description' in data.error &&
      typeof data.error.description === 'string'
        ? data.error.description
        : `Razorpay order failed (${response.status})`;
    throw new Error(description);
  }
  const id = data && typeof data === 'object' && 'id' in data ? data.id : null;
  const amount = data && typeof data === 'object' && 'amount' in data ? data.amount : null;
  if (typeof id !== 'string' || amount !== input.amountPaise) {
    throw new Error('Razorpay returned an unexpected order');
  }
  return { id };
}
