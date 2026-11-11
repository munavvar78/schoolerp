import { describe, expect, it } from 'vitest';
import { findTimetableConflicts } from './timetable.js';

describe('timetable conflicts', () => {
  it('flags teacher double-book', () => {
    const conflicts = findTimetableConflicts([
      {
        dayOfWeek: 1,
        periodSlotId: 'p1',
        teacherUserId: 't1',
        sectionId: 's1',
      },
      {
        dayOfWeek: 1,
        periodSlotId: 'p1',
        teacherUserId: 't1',
        sectionId: 's2',
      },
    ]);
    expect(conflicts.some((c) => c.type === 'TEACHER_DOUBLE_BOOK')).toBe(true);
  });

  it('allows same teacher different periods', () => {
    const conflicts = findTimetableConflicts([
      {
        dayOfWeek: 1,
        periodSlotId: 'p1',
        teacherUserId: 't1',
        sectionId: 's1',
      },
      {
        dayOfWeek: 1,
        periodSlotId: 'p2',
        teacherUserId: 't1',
        sectionId: 's1',
      },
    ]);
    expect(conflicts).toHaveLength(0);
  });
});
