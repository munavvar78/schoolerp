/** Calendar dates as YYYY-MM-DD in local school time (not UTC midnight). */

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return todayIsoDate(value);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function compareIsoDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isFutureIsoDate(date: string, today = todayIsoDate()): boolean {
  return compareIsoDates(date, today) > 0;
}

export function isPastIsoDate(date: string, today = todayIsoDate()): boolean {
  return compareIsoDates(date, today) < 0;
}

export type DateRange = {
  startDate: Date | string;
  endDate: Date | string;
};

/**
 * Attendance may be marked for today or past days inside the academic session —
 * never for a future calendar day.
 */
export function validateAttendanceDate(
  date: string,
  session?: DateRange | null,
  today = todayIsoDate(),
): { ok: true } | { ok: false; message: string } {
  if (!isIsoDate(date)) {
    return { ok: false, message: 'Attendance date must be YYYY-MM-DD' };
  }
  if (isFutureIsoDate(date, today)) {
    return { ok: false, message: 'Cannot mark attendance for a future date' };
  }
  if (session) {
    const start = toIsoDate(session.startDate);
    const end = toIsoDate(session.endDate);
    if (compareIsoDates(date, start) < 0 || compareIsoDates(date, end) > 0) {
      return {
        ok: false,
        message: `Attendance date must be within the academic session (${start} to ${end})`,
      };
    }
  }
  return { ok: true };
}

/** DOB / historical events cannot be in the future. */
export function validateNotFutureDate(
  date: string | undefined | null,
  label = 'Date',
  today = todayIsoDate(),
): { ok: true } | { ok: false; message: string } {
  if (!date) return { ok: true };
  if (!isIsoDate(date)) {
    return { ok: false, message: `${label} must be YYYY-MM-DD` };
  }
  if (isFutureIsoDate(date, today)) {
    return { ok: false, message: `${label} cannot be in the future` };
  }
  return { ok: true };
}
