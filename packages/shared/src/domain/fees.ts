export interface FeeLineInput {
  amountPaise: number;
  concessionPaise?: number;
}

export function feeDemandTotalPaise(lines: FeeLineInput[]): number {
  return lines.reduce((sum, line) => {
    const concession = line.concessionPaise ?? 0;
    return sum + Math.max(0, line.amountPaise - concession);
  }, 0);
}

export interface LateFeeConfig {
  /** Fixed late fee in paise after grace days. */
  fixedPaise: number;
  /** Percent of outstanding (0-100), applied after grace days. */
  percent: number;
  graceDays: number;
}

export function computeLateFeePaise(
  outstandingPaise: number,
  dueDate: Date,
  asOf: Date,
  config: LateFeeConfig,
): number {
  if (outstandingPaise <= 0) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.floor((asOf.getTime() - dueDate.getTime()) / msPerDay);
  if (daysLate <= config.graceDays) return 0;
  const percentPart = Math.round((outstandingPaise * config.percent) / 100);
  return config.fixedPaise + percentPart;
}

export function outstandingPaise(
  demandTotalPaise: number,
  paidPaise: number,
  lateFeePaise = 0,
): number {
  return Math.max(0, demandTotalPaise + lateFeePaise - paidPaise);
}

export function paymentWithinOutstanding(
  amountPaise: number,
  outstanding: number,
): { ok: true } | { ok: false; message: string } {
  if (!Number.isInteger(amountPaise) || amountPaise < 1) {
    return { ok: false, message: 'Payment amount must be a positive whole number of paise' };
  }
  if (!Number.isInteger(outstanding) || outstanding < 0) {
    return { ok: false, message: 'Outstanding balance is not available' };
  }
  if (amountPaise > outstanding) {
    return { ok: false, message: 'Amount exceeds outstanding dues' };
  }
  return { ok: true };
}
