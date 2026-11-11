import { describe, expect, it } from 'vitest';
import {
  isFutureIsoDate,
  isIsoDate,
  todayIsoDate,
  validateAttendanceDate,
  validateNotFutureDate,
} from './dates.js';

describe('dates', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-04-07')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('26-04-07')).toBe(false);
  });

  it('detects future dates vs a fixed today', () => {
    expect(isFutureIsoDate('2026-04-08', '2026-04-07')).toBe(true);
    expect(isFutureIsoDate('2026-04-07', '2026-04-07')).toBe(false);
    expect(isFutureIsoDate('2026-04-06', '2026-04-07')).toBe(false);
  });

  it('blocks future attendance', () => {
    const result = validateAttendanceDate('2026-04-10', null, '2026-04-07');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/future/i);
  });

  it('requires attendance inside session window', () => {
    const session = {
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    };
    expect(validateAttendanceDate('2026-03-31', session, '2026-04-07').ok).toBe(false);
    expect(validateAttendanceDate('2026-04-07', session, '2026-04-07').ok).toBe(true);
  });

  it('blocks future DOB', () => {
    const result = validateNotFutureDate('2099-01-01', 'Date of birth', '2026-04-07');
    expect(result.ok).toBe(false);
  });

  it('returns local today shape', () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
