import { describe, expect, it } from 'vitest';
import { isFamilyDashboardRole } from './audience.js';

describe('dashboard audience', () => {
  it('limits parent and student dashboards to their own students', () => {
    expect(isFamilyDashboardRole('PARENT')).toBe(true);
    expect(isFamilyDashboardRole('STUDENT')).toBe(true);
    expect(isFamilyDashboardRole('TEACHER')).toBe(false);
    expect(isFamilyDashboardRole('CAMPUS_ADMIN')).toBe(false);
  });
});
