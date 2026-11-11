import { describe, expect, it } from 'vitest';
import { canTransitionAdmission, nextAdmissionNumber } from './admissions.js';

describe('admission transitions', () => {
  it('allows draft to submitted', () => {
    expect(canTransitionAdmission('DRAFT', 'SUBMITTED')).toBe(true);
  });

  it('blocks enrolled to offered', () => {
    expect(canTransitionAdmission('ENROLLED', 'OFFERED')).toBe(false);
  });

  it('allows offered to accepted', () => {
    expect(canTransitionAdmission('OFFERED', 'ACCEPTED')).toBe(true);
  });

  it('builds India-style admission numbers', () => {
    expect(nextAdmissionNumber('ADM-', 2026, 12)).toBe('ADM-2026-0012');
  });
});
