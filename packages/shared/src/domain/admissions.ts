import type { AdmissionStatus } from '../constants.js';

const ALLOWED: Record<AdmissionStatus, AdmissionStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WAITLISTED', 'OFFERED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['WAITLISTED', 'OFFERED', 'REJECTED', 'WITHDRAWN'],
  WAITLISTED: ['UNDER_REVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN'],
  OFFERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: ['ENROLLED', 'WITHDRAWN'],
  ENROLLED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function canTransitionAdmission(
  from: AdmissionStatus,
  to: AdmissionStatus,
): boolean {
  if (from === to) return false;
  return (ALLOWED[from] ?? []).includes(to);
}

export function nextAdmissionNumber(
  prefix: string,
  year: number,
  sequence: number,
): string {
  const padded = String(sequence).padStart(4, '0');
  return `${prefix}${year}-${padded}`;
}
