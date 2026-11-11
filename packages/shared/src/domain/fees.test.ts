import { describe, expect, it } from 'vitest';
import {
  computeLateFeePaise,
  feeDemandTotalPaise,
  outstandingPaise,
  paymentWithinOutstanding,
} from './fees.js';

describe('fees domain', () => {
  it('sums fee lines with concessions', () => {
    expect(
      feeDemandTotalPaise([
        { amountPaise: 100000, concessionPaise: 10000 },
        { amountPaise: 50000 },
      ]),
    ).toBe(140000);
  });

  it('applies late fee after grace', () => {
    const due = new Date('2026-04-01T00:00:00Z');
    const asOf = new Date('2026-04-15T00:00:00Z');
    expect(
      computeLateFeePaise(100000, due, asOf, {
        fixedPaise: 5000,
        percent: 2,
        graceDays: 7,
      }),
    ).toBe(7000);
  });

  it('skips late fee within grace', () => {
    const due = new Date('2026-04-01T00:00:00Z');
    const asOf = new Date('2026-04-05T00:00:00Z');
    expect(
      computeLateFeePaise(100000, due, asOf, {
        fixedPaise: 5000,
        percent: 2,
        graceDays: 7,
      }),
    ).toBe(0);
  });

  it('computes outstanding', () => {
    expect(outstandingPaise(100000, 40000, 5000)).toBe(65000);
  });

  it('rejects a payment above the outstanding balance', () => {
    expect(paymentWithinOutstanding(65000, 65000)).toEqual({ ok: true });
    expect(paymentWithinOutstanding(65001, 65000).ok).toBe(false);
    expect(paymentWithinOutstanding(0, 65000).ok).toBe(false);
  });
});
