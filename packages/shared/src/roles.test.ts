import { describe, expect, it } from 'vitest';
import { isModuleEnabled, canWriteTransport, canInviteRole } from './roles.js';

describe('ai module access', () => {
  it('keeps campus-wide copilot facts away from family logins', () => {
    expect(isModuleEnabled('PARENT', 'ai', null)).toBe(false);
    expect(isModuleEnabled('STUDENT', 'ai', null)).toBe(false);
    expect(isModuleEnabled('TEACHER', 'ai', null)).toBe(true);
    expect(isModuleEnabled('TEACHER', 'ai', ['dashboard'])).toBe(false);
  });

  it('lets only campus managers change transport routes', () => {
    expect(canWriteTransport('CAMPUS_ADMIN')).toBe(true);
    expect(canWriteTransport('PARENT')).toBe(false);
    expect(canWriteTransport('STUDENT')).toBe(false);
  });

  it('keeps exam and attendance reads off the accountant role', () => {
    expect(isModuleEnabled('ACCOUNTANT', 'exams', null)).toBe(false);
    expect(isModuleEnabled('ACCOUNTANT', 'attendance', null)).toBe(false);
    expect(isModuleEnabled('ACCOUNTANT', 'inventory', null)).toBe(true);
    expect(isModuleEnabled('PARENT', 'exams', null)).toBe(true);
    expect(isModuleEnabled('PARENT', 'attendance', null)).toBe(true);
  });

  it('lets an owner invite school roles and keeps a campus admin on their own campus', () => {
    expect(canInviteRole('ORG_OWNER', 'CAMPUS_ADMIN', 'campus-a', 'campus-b')).toBe(true);
    expect(canInviteRole('ORG_OWNER', 'PLATFORM_OPERATOR', 'campus-a', 'campus-a')).toBe(false);
    expect(canInviteRole('CAMPUS_ADMIN', 'TEACHER', 'campus-a', 'campus-a')).toBe(true);
    expect(canInviteRole('CAMPUS_ADMIN', 'ORG_OWNER', 'campus-a', 'campus-a')).toBe(false);
    expect(canInviteRole('CAMPUS_ADMIN', 'TEACHER', 'campus-a', 'campus-b')).toBe(false);
    expect(canInviteRole('PARENT', 'TEACHER', 'campus-a', 'campus-a')).toBe(false);
    expect(canInviteRole('STUDENT', 'ORG_OWNER', 'campus-a', 'campus-a')).toBe(false);
  });
});
