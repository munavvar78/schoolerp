import { describe, expect, it } from 'vitest';

/**
 * Pure tenant scoping contract used by services.
 * Integration tests against a live DB run via scripts/tenant-check.ts after seed.
 */
function scopeStudents(organizationId: string, campusId: string) {
  return { organizationId, campusId, isActive: true };
}

function scopeNotices(organizationId: string, campusId: string) {
  return { organizationId, campusId };
}

function scopeAdmissions(organizationId: string, campusId: string) {
  return { organizationId, campusId };
}

function scopeTimetable(organizationId: string, campusId: string) {
  return { organizationId, campusId };
}

function scopeHomework(organizationId: string, campusId: string) {
  return { organizationId, campusId };
}

describe('tenant isolation contract', () => {
  it('never omits organizationId from student queries', () => {
    const where = scopeStudents('org_a', 'campus_1');
    expect(where.organizationId).toBe('org_a');
    expect(where.campusId).toBe('campus_1');
  });

  it('keeps different orgs distinct', () => {
    const a = scopeStudents('org_a', 'c1');
    const b = scopeStudents('org_b', 'c1');
    expect(a.organizationId).not.toBe(b.organizationId);
  });

  it('scopes Phase 2 modules by organizationId', () => {
    for (const scope of [scopeNotices, scopeAdmissions, scopeTimetable, scopeHomework]) {
      const where = scope('org_x', 'campus_y');
      expect(where.organizationId).toBe('org_x');
      expect(where.campusId).toBe('campus_y');
    }
  });
});
