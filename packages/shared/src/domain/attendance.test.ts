import { describe, expect, it } from 'vitest';
import {
  absentStatusCode,
  attendancePercentage,
  completeAttendanceRoster,
  isAttendanceShortage,
  lateStatusCode,
  presentStatusCode,
} from './attendance.js';

const statuses = [
  { code: 'PRESENT', countsAsPresent: true, weight: 1 },
  { code: 'ABSENT', countsAsPresent: false, weight: 1 },
  { code: 'HALF_DAY', countsAsPresent: true, weight: 0.5 },
  { code: 'LATE', countsAsPresent: true, weight: 1 },
];

describe('attendancePercentage', () => {
  it('returns 0 for empty marks', () => {
    expect(attendancePercentage([], statuses)).toBe(0);
  });

  it('computes full attendance', () => {
    expect(
      attendancePercentage(
        [{ statusCode: 'PRESENT' }, { statusCode: 'PRESENT' }],
        statuses,
      ),
    ).toBe(100);
  });

  it('handles half days', () => {
    expect(
      attendancePercentage(
        [{ statusCode: 'PRESENT' }, { statusCode: 'HALF_DAY' }],
        statuses,
      ),
    ).toBeCloseTo(100, 0);
  });

  it('detects shortage', () => {
    const pct = attendancePercentage(
      [
        { statusCode: 'PRESENT' },
        { statusCode: 'ABSENT' },
        { statusCode: 'ABSENT' },
        { statusCode: 'ABSENT' },
      ],
      statuses,
    );
    expect(pct).toBe(25);
    expect(isAttendanceShortage(pct, 75)).toBe(true);
  });
});

describe('attendance roster defaults', () => {
  const defs = [
    { code: 'PRESENT', countsAsPresent: true },
    { code: 'ABSENT', countsAsPresent: false },
    { code: 'LATE', countsAsPresent: true },
    { code: 'EXCUSED', countsAsPresent: false },
  ];

  it('prefers present, absent, and late codes', () => {
    expect(presentStatusCode(defs)).toBe('PRESENT');
    expect(absentStatusCode(defs)).toBe('ABSENT');
    expect(lateStatusCode(defs)).toBe('LATE');
    expect(presentStatusCode([{ code: 'P', countsAsPresent: true }])).toBe('P');
    expect(lateStatusCode(defs.filter((status) => status.code !== 'LATE'))).toBeNull();
  });

  it('fills unmarked students as present and keeps explicit absences', () => {
    const roster = completeAttendanceRoster(
      ['enr_1', 'enr_2', 'enr_3'],
      [
        { enrollmentId: 'enr_2', statusCode: 'ABSENT', remark: 'sick' },
        { enrollmentId: 'enr_3', statusCode: 'LATE' },
      ],
      'PRESENT',
    );
    expect(roster).toEqual([
      { enrollmentId: 'enr_1', statusCode: 'PRESENT' },
      { enrollmentId: 'enr_2', statusCode: 'ABSENT', remark: 'sick' },
      { enrollmentId: 'enr_3', statusCode: 'LATE' },
    ]);
  });

  it('treats an empty mark list as everyone present', () => {
    expect(completeAttendanceRoster(['enr_1', 'enr_2'], [], 'PRESENT')).toEqual([
      { enrollmentId: 'enr_1', statusCode: 'PRESENT' },
      { enrollmentId: 'enr_2', statusCode: 'PRESENT' },
    ]);
  });
});
