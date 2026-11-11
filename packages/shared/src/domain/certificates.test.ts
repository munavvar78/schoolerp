import { describe, expect, it } from 'vitest';
import {
  canIssueFeeClearance,
  certificateSerial,
  isVerificationCode,
  publicCertificateView,
} from './certificates.js';

describe('certificates', () => {
  it('formats a yearly serial', () => {
    expect(certificateSerial(2026, 12)).toBe('CERT-2026-000012');
  });

  it('accepts only 64 hex verification codes', () => {
    expect(isVerificationCode('a'.repeat(64))).toBe(true);
    expect(isVerificationCode('A'.repeat(64))).toBe(false);
    expect(isVerificationCode('abc')).toBe(false);
  });

  it('issues fee clearance only when nothing is outstanding', () => {
    expect(canIssueFeeClearance(0)).toBe(true);
    expect(canIssueFeeClearance(1)).toBe(false);
  });

  it('hides the rest of the surname and the purpose on the public view', () => {
    const view = publicCertificateView({
      type: 'BONAFIDE',
      serialNo: 'CERT-2026-000001',
      issuedAt: '2026-04-01T00:00:00.000Z',
      studentFirstName: 'Aarav',
      studentLastName: 'Sharma',
      campusName: 'Delhi',
    });
    expect(view.studentName).toBe('Aarav S.');
    expect(view.valid).toBe(true);
    expect(view).not.toHaveProperty('purpose');
    expect(
      publicCertificateView({
        type: 'TRANSFER',
        serialNo: 'CERT-2026-000002',
        issuedAt: '2026-04-01T00:00:00.000Z',
        revokedAt: '2026-05-01T00:00:00.000Z',
        studentFirstName: 'Aarav',
        campusName: 'Delhi',
      }).valid,
    ).toBe(false);
  });
});
