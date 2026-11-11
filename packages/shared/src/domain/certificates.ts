export const CERTIFICATE_TYPES = ['BONAFIDE', 'TRANSFER', 'CHARACTER', 'FEE_CLEARANCE'] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export function certificateSerial(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('Certificate year is not valid');
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Certificate sequence must be a positive integer');
  }
  return `CERT-${year}-${String(sequence).padStart(6, '0')}`;
}

export function isVerificationCode(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function canIssueFeeClearance(outstandingPaise: number): boolean {
  return Number.isInteger(outstandingPaise) && outstandingPaise === 0;
}

export interface PublicCertificate {
  valid: boolean;
  status: 'VALID' | 'REVOKED';
  type: CertificateType;
  serialNo: string;
  issuedAt: string;
  studentName: string;
  campusName: string;
}

/** Fields safe to show without a login. The verification code is the capability. */
export function publicCertificateView(input: {
  type: CertificateType;
  serialNo: string;
  issuedAt: string;
  revokedAt?: string | null;
  studentFirstName: string;
  studentLastName?: string | null;
  campusName: string;
}): PublicCertificate {
  const last = input.studentLastName?.trim();
  const initial = last ? ` ${last.slice(0, 1)}.` : '';
  const revoked = Boolean(input.revokedAt);
  return {
    valid: !revoked,
    status: revoked ? 'REVOKED' : 'VALID',
    type: input.type,
    serialNo: input.serialNo,
    issuedAt: input.issuedAt,
    studentName: `${input.studentFirstName.trim()}${initial}`,
    campusName: input.campusName,
  };
}
