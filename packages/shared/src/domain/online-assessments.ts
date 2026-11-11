export type McqOption = {
  id: string;
  text: string;
  isCorrect?: boolean;
};

export type PublicMcqOption = {
  id: string;
  text: string;
};

/** Soft warnings only (camera). Tab leave is blocked client-side — not a warning. */
export const PROCTOR_WARNING_TYPES = [
  'CAMERA_FACE_MISSING_TIMEOUT',
  'CAMERA_MULTI_FACE',
  'CAMERA_LOOKING_AWAY',
] as const;

/** Tab / fullscreen leave — logged only; UI forces focus back (no warning ladder). */
export const PROCTOR_TAB_BLOCK_TYPES = ['TAB_BLUR', 'TAB_HIDDEN', 'FULLSCREEN_EXIT'] as const;

export const PROCTOR_HARD_LOCK_TYPES = ['CAMERA_DENIED', 'CAMERA_STREAM_LOST'] as const;

export type ProctorWarningType = (typeof PROCTOR_WARNING_TYPES)[number];
export type ProctorHardLockType = (typeof PROCTOR_HARD_LOCK_TYPES)[number];

export function isProctorWarningType(type: string): type is ProctorWarningType {
  return (PROCTOR_WARNING_TYPES as readonly string[]).includes(type);
}

export function isProctorTabBlockType(type: string): boolean {
  return (PROCTOR_TAB_BLOCK_TYPES as readonly string[]).includes(type);
}

export function isProctorHardLockType(type: string): type is ProctorHardLockType {
  return (PROCTOR_HARD_LOCK_TYPES as readonly string[]).includes(type);
}

export function stripCorrectFlags(options: McqOption[]): PublicMcqOption[] {
  return options.map(({ id, text }) => ({ id, text }));
}

/**
 * All-or-nothing grading for choice questions (single or multi-correct):
 * full marks only when the selected option id set exactly matches the correct set.
 * Partial credit is not awarded for MULTIPLE_CHOICE.
 */
export function gradeMcqAnswer(
  options: McqOption[],
  selectedOptionIds: string[],
): { isCorrect: boolean; marksAwarded: number; maxMarks: number } {
  const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id).sort();
  const selected = [...new Set(selectedOptionIds)].sort();
  const isCorrect =
    correctIds.length > 0 &&
    correctIds.length === selected.length &&
    correctIds.every((id, i) => id === selected[i]);
  return { isCorrect, marksAwarded: isCorrect ? 1 : 0, maxMarks: 1 };
}

export function gradeMcqAnswerScaled(
  options: McqOption[],
  selectedOptionIds: string[],
  marks: number,
): { isCorrect: boolean; marksAwarded: number } {
  const base = gradeMcqAnswer(options, selectedOptionIds);
  return {
    isCorrect: base.isCorrect,
    marksAwarded: base.isCorrect ? marks : 0,
  };
}

export type StaffQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'YES_NO'
  | 'THIS_OR_THAT';

export function normalizeStaffQuestionType(type: string): StaffQuestionType {
  if (type === 'MCQ' || type === 'SHORT_TEXT') return 'SINGLE_CHOICE';
  if (
    type === 'SINGLE_CHOICE' ||
    type === 'MULTIPLE_CHOICE' ||
    type === 'YES_NO' ||
    type === 'THIS_OR_THAT'
  ) {
    return type;
  }
  return 'SINGLE_CHOICE';
}

export function questionTypeLabel(type: string): string {
  switch (normalizeStaffQuestionType(type)) {
    case 'SINGLE_CHOICE':
      return 'Single choice';
    case 'MULTIPLE_CHOICE':
      return 'Multiple correct';
    case 'YES_NO':
      return 'Yes / No';
    case 'THIS_OR_THAT':
      return 'This or that';
    default:
      return type;
  }
}

/** True when the student UI should use checkboxes (multi-select). */
export function isMultiSelectQuestionType(type: string): boolean {
  return normalizeStaffQuestionType(type) === 'MULTIPLE_CHOICE';
}

export function warningCauseLabel(type: string): string {
  switch (type) {
    case 'TAB_BLUR':
    case 'TAB_HIDDEN':
      return 'Tab switching is not allowed';
    case 'FULLSCREEN_EXIT':
      return 'Left fullscreen mode';
    case 'CAMERA_FACE_MISSING_TIMEOUT':
      return 'Face not visible for too long';
    case 'CAMERA_MULTI_FACE':
      return 'Multiple faces detected';
    case 'CAMERA_LOOKING_AWAY':
      return 'Looking away from screen';
    case 'CAMERA_DENIED':
      return 'Camera permission denied';
    case 'CAMERA_STREAM_LOST':
      return 'Camera disconnected';
    default:
      return type;
  }
}

export function composeWarningsExceededMessage(causes: string[]): string {
  const details =
    causes.length > 0
      ? causes.map((c, i) => `${i + 1}) ${c}`).join('; ')
      : 'Proctoring policy violated';
  return `Exam locked after 3 warnings (camera / presence issues). Details: ${details}`;
}

export function hardLockMessage(type: ProctorHardLockType): { code: string; message: string } {
  if (type === 'CAMERA_DENIED') {
    return {
      code: 'CAMERA_DENIED',
      message: 'Exam locked: camera permission is required for this exam.',
    };
  }
  return {
    code: 'CAMERA_STREAM_LOST',
    message: 'Exam locked: camera was disconnected.',
  };
}

export function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
