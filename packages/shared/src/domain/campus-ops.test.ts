import { describe, expect, it } from 'vitest';
import {
  canAllocateBed,
  canAssignSeat,
  canIssueLoan,
  canRequestLeave,
  computePayroll,
  erasureDisposition,
  gateOutboundMessage,
  nextStock,
  validateApaar,
} from './campus-ops.js';

describe('campus operations', () => {
  it('accepts a 12-digit APAAR ID only when issued', () => {
    expect(validateApaar('ISSUED', '123456789012')).toEqual({ ok: true, apaarId: '123456789012' });
    expect(validateApaar('ISSUED', '123').ok).toBe(false);
    expect(validateApaar('REFUSED', null)).toEqual({ ok: true, apaarId: null });
    expect(validateApaar('NOGEN', '123456789012').ok).toBe(false);
  });

  it('blocks a second loan of the same copy and borrowing while a book is overdue', () => {
    expect(canIssueLoan({ copyOnLoan: true, overdueLoans: 0 }).ok).toBe(false);
    expect(canIssueLoan({ copyOnLoan: false, overdueLoans: 1 }).ok).toBe(false);
    expect(canIssueLoan({ copyOnLoan: false, overdueLoans: 0 })).toEqual({ ok: true });
  });

  it('stops transport and hostel assignments at capacity', () => {
    expect(canAssignSeat(40, 40).ok).toBe(false);
    expect(canAssignSeat(39, 40)).toEqual({ ok: true });
    expect(canAllocateBed(2, 2).ok).toBe(false);
  });

  it('refuses stock that would go negative', () => {
    expect(nextStock(3, -4).ok).toBe(false);
    expect(nextStock(3, -2)).toEqual({ ok: true, onHand: 1 });
  });

  it('caps leave at the balance and PF at the wage ceiling', () => {
    expect(canRequestLeave(2, 3).ok).toBe(false);
    expect(canRequestLeave(2, 2)).toEqual({ ok: true });
    const payroll = computePayroll({ basicPaise: 2_000_000, hraPaise: 500_000 });
    expect(payroll.pfPaise).toBe(180_000);
    expect(payroll.netPaise).toBe(2_000_000 + 500_000 - 180_000);
  });

  it('does not send a message without consent and a configured provider', () => {
    expect(gateOutboundMessage({ consent: false, configured: true }).status).toBe('BLOCKED_NO_CONSENT');
    expect(gateOutboundMessage({ consent: true, configured: false }).status).toBe('BLOCKED_UNCONFIGURED');
    expect(gateOutboundMessage({ consent: true, configured: true }).status).toBe('READY');
  });

  it('keeps an erasure request open and retains finance rows', () => {
    expect(erasureDisposition().retainFinance).toBe(true);
    expect(erasureDisposition().status).toBe('OPEN');
  });
});
