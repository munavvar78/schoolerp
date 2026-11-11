import { describe, expect, it } from 'vitest';
import { assertMarkWithinMax, gradeFromScale, weightedTotal } from './exams.js';

describe('exams domain', () => {
  it('computes weighted percentage', () => {
    const result = weightedTotal([
      { maxMarks: 80, weight: 70, obtained: 56 },
      { maxMarks: 20, weight: 30, obtained: 18 },
    ]);
    expect(result.percentage).toBeCloseTo(76, 0);
  });

  it('maps grade from scale', () => {
    const bands = [
      { minPercent: 90, maxPercent: 100, grade: 'A1', isPass: true },
      { minPercent: 80, maxPercent: 89.99, grade: 'A2', isPass: true },
      { minPercent: 33, maxPercent: 79.99, grade: 'B', isPass: true },
      { minPercent: 0, maxPercent: 32.99, grade: 'E', isPass: false },
    ];
    expect(gradeFromScale(85, bands, 33)).toEqual({ grade: 'A2', isPass: true });
    expect(gradeFromScale(20, bands, 33)).toEqual({ grade: 'E', isPass: false });
  });

  it('rejects marks above the component maximum', () => {
    expect(assertMarkWithinMax(80, 80)).toEqual({ ok: true });
    expect(assertMarkWithinMax(null, 80)).toEqual({ ok: true });
    expect(assertMarkWithinMax(81, 80).ok).toBe(false);
    expect(assertMarkWithinMax(-1, 80).ok).toBe(false);
  });
});
