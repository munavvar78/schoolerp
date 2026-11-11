import { describe, expect, it } from 'vitest';
import {
  composeWarningsExceededMessage,
  isProctorTabBlockType,
  isProctorWarningType,
  warningCauseLabel,
} from '@school-erp/shared';

describe('online assessment proctor policy helpers', () => {
  it('treats tab events as block types, not warnings', () => {
    expect(isProctorTabBlockType('TAB_HIDDEN')).toBe(true);
    expect(isProctorWarningType('TAB_HIDDEN')).toBe(false);
    expect(isProctorWarningType('CAMERA_FACE_MISSING_TIMEOUT')).toBe(true);
  });

  it('builds lock reason after camera warnings', () => {
    const causes = [
      warningCauseLabel('CAMERA_FACE_MISSING_TIMEOUT'),
      warningCauseLabel('CAMERA_MULTI_FACE'),
      warningCauseLabel('CAMERA_LOOKING_AWAY'),
    ];
    const message = composeWarningsExceededMessage(causes);
    expect(message).toMatch(/3 warnings/i);
    expect(message).toContain('1)');
    expect(message).toContain('Face not visible');
    expect(message).toContain('Multiple faces');
  });
});
