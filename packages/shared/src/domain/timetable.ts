export type TimetableConflictInput = {
  dayOfWeek: number;
  periodSlotId: string;
  teacherUserId: string;
  sectionId: string;
};

export type TimetableConflict = {
  type: 'TEACHER_DOUBLE_BOOK' | 'SECTION_SLOT_TAKEN';
  dayOfWeek: number;
  periodSlotId: string;
  teacherUserId?: string;
  sectionId?: string;
};

/** Detect teacher double-booking and duplicate section slots within a proposed grid. */
export function findTimetableConflicts(
  entries: TimetableConflictInput[],
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  const teacherSlots = new Map<string, TimetableConflictInput>();
  const sectionSlots = new Map<string, TimetableConflictInput>();

  for (const entry of entries) {
    const teacherKey = `${entry.teacherUserId}|${entry.dayOfWeek}|${entry.periodSlotId}`;
    const sectionKey = `${entry.sectionId}|${entry.dayOfWeek}|${entry.periodSlotId}`;

    if (teacherSlots.has(teacherKey)) {
      conflicts.push({
        type: 'TEACHER_DOUBLE_BOOK',
        dayOfWeek: entry.dayOfWeek,
        periodSlotId: entry.periodSlotId,
        teacherUserId: entry.teacherUserId,
      });
    } else {
      teacherSlots.set(teacherKey, entry);
    }

    if (sectionSlots.has(sectionKey)) {
      conflicts.push({
        type: 'SECTION_SLOT_TAKEN',
        dayOfWeek: entry.dayOfWeek,
        periodSlotId: entry.periodSlotId,
        sectionId: entry.sectionId,
      });
    } else {
      sectionSlots.set(sectionKey, entry);
    }
  }

  return conflicts;
}
