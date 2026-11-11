import { describe, expect, it } from 'vitest';
import {
  composeWarningsExceededMessage,
  gradeMcqAnswerScaled,
  isProctorHardLockType,
  isProctorWarningType,
  stripCorrectFlags,
  warningCauseLabel,
} from './online-assessments.js';

describe('online assessments', () => {
  it('strips correct flags for student view', () => {
    expect(
      stripCorrectFlags([
        { id: 'a', text: 'One', isCorrect: true },
        { id: 'b', text: 'Two', isCorrect: false },
      ]),
    ).toEqual([
      { id: 'a', text: 'One' },
      { id: 'b', text: 'Two' },
    ]);
  });

  it('grades MCQ with marks scale', () => {
    const options = [
      { id: 'a', text: 'One', isCorrect: true },
      { id: 'b', text: 'Two', isCorrect: false },
    ];
    expect(gradeMcqAnswerScaled(options, ['a'], 5)).toEqual({
      isCorrect: true,
      marksAwarded: 5,
    });
    expect(gradeMcqAnswerScaled(options, ['b'], 5)).toEqual({
      isCorrect: false,
      marksAwarded: 0,
    });
  });

  it('grades multiple-correct all-or-nothing', () => {
    const options = [
      { id: 'a', text: 'A', isCorrect: true },
      { id: 'b', text: 'B', isCorrect: true },
      { id: 'c', text: 'C', isCorrect: false },
    ];
    expect(gradeMcqAnswerScaled(options, ['a', 'b'], 3)).toEqual({
      isCorrect: true,
      marksAwarded: 3,
    });
    expect(gradeMcqAnswerScaled(options, ['a'], 3)).toEqual({
      isCorrect: false,
      marksAwarded: 0,
    });
    expect(gradeMcqAnswerScaled(options, ['a', 'b', 'c'], 3)).toEqual({
      isCorrect: false,
      marksAwarded: 0,
    });
  });

  it('classifies proctor types', () => {
    expect(isProctorWarningType('TAB_HIDDEN')).toBe(false);
    expect(isProctorWarningType('CAMERA_FACE_MISSING_TIMEOUT')).toBe(true);
    expect(isProctorHardLockType('CAMERA_DENIED')).toBe(true);
    expect(isProctorWarningType('CAMERA_DENIED')).toBe(false);
  });

  it('composes lock reason from warning causes', () => {
    const msg = composeWarningsExceededMessage([
      warningCauseLabel('CAMERA_FACE_MISSING_TIMEOUT'),
      warningCauseLabel('CAMERA_MULTI_FACE'),
    ]);
    expect(msg).toContain('3 warnings');
    expect(msg).toContain('Face not visible');
    expect(msg).toContain('Multiple faces');
  });
});
