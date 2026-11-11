export const APAAR_STATUSES = ['MISSING', 'ISSUED', 'REFUSED', 'NOGEN'] as const;
export type ApaarStatus = (typeof APAAR_STATUSES)[number];

export function validateApaar(
  status: ApaarStatus,
  apaarId?: string | null,
): { ok: true; apaarId: string | null } | { ok: false; message: string } {
  const id = apaarId?.trim() || null;
  if (status === 'ISSUED') {
    if (!id || !/^\d{12}$/.test(id)) {
      return { ok: false, message: 'An issued APAAR ID must be 12 digits' };
    }
    return { ok: true, apaarId: id };
  }
  if (id) return { ok: false, message: 'Store an APAAR ID only when the status is ISSUED' };
  return { ok: true, apaarId: null };
}

export function canIssueLoan(input: { copyOnLoan: boolean; overdueLoans: number; maxOverdue?: number }):
  | { ok: true }
  | { ok: false; message: string } {
  const maxOverdue = input.maxOverdue ?? 0;
  if (input.copyOnLoan) return { ok: false, message: 'This copy is already on loan' };
  if (input.overdueLoans > maxOverdue) {
    return { ok: false, message: 'Return overdue books before borrowing again' };
  }
  return { ok: true };
}

export function canAssignSeat(assigned: number, capacity: number):
  | { ok: true }
  | { ok: false; message: string } {
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { ok: false, message: 'Route capacity must be at least 1' };
  }
  if (assigned >= capacity) return { ok: false, message: 'This route is full' };
  return { ok: true };
}

export function nextStock(onHand: number, delta: number): { ok: true; onHand: number } | { ok: false; message: string } {
  if (!Number.isInteger(onHand) || !Number.isInteger(delta)) {
    return { ok: false, message: 'Stock quantities must be whole numbers' };
  }
  const next = onHand + delta;
  if (next < 0) return { ok: false, message: 'Stock cannot go negative' };
  return { ok: true, onHand: next };
}

export function canAllocateBed(occupied: number, beds: number):
  | { ok: true }
  | { ok: false; message: string } {
  if (!Number.isInteger(beds) || beds < 1) return { ok: false, message: 'A room needs at least one bed' };
  if (occupied >= beds) return { ok: false, message: 'This room is full' };
  return { ok: true };
}

export function canRequestLeave(balance: number, days: number):
  | { ok: true }
  | { ok: false; message: string } {
  if (!Number.isInteger(days) || days < 1) return { ok: false, message: 'Leave must be at least one whole day' };
  if (days > balance) return { ok: false, message: 'Leave request exceeds the balance' };
  return { ok: true };
}

/** Employee PF is 12% of basic, capped at the statutory wage ceiling (₹15,000). */
export function computePayroll(input: { basicPaise: number; hraPaise: number; pfCeilingPaise?: number }): {
  basicPaise: number;
  hraPaise: number;
  pfPaise: number;
  grossPaise: number;
  netPaise: number;
} {
  if (!Number.isInteger(input.basicPaise) || input.basicPaise < 0) {
    throw new Error('Basic pay must be a non-negative integer number of paise');
  }
  if (!Number.isInteger(input.hraPaise) || input.hraPaise < 0) {
    throw new Error('HRA must be a non-negative integer number of paise');
  }
  const ceiling = input.pfCeilingPaise ?? 1_500_000;
  const pfBase = Math.min(input.basicPaise, ceiling);
  const pfPaise = Math.round((pfBase * 12) / 100);
  const grossPaise = input.basicPaise + input.hraPaise;
  return {
    basicPaise: input.basicPaise,
    hraPaise: input.hraPaise,
    pfPaise,
    grossPaise,
    netPaise: grossPaise - pfPaise,
  };
}

export type OutboundStatus = 'READY' | 'BLOCKED_NO_CONSENT' | 'BLOCKED_UNCONFIGURED';

export function gateOutboundMessage(input: { consent: boolean; configured: boolean }): { status: OutboundStatus } {
  if (!input.consent) return { status: 'BLOCKED_NO_CONSENT' };
  if (!input.configured) return { status: 'BLOCKED_UNCONFIGURED' };
  return { status: 'READY' };
}

export function erasureDisposition(): {
  status: 'OPEN';
  retainFinance: true;
  reason: string;
} {
  return {
    status: 'OPEN',
    retainFinance: true,
    reason: 'Fee, invoice, and payroll rows stay for statutory retention. A person reviews the request.',
  };
}
