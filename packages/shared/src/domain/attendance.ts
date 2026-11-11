export type AttendanceStatusCode = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'EXCUSED';

export interface AttendanceStatusDef {
  code: string;
  countsAsPresent: boolean;
  weight: number;
}

export interface AttendanceRosterMark {
  enrollmentId: string;
  statusCode: string;
  remark?: string;
}

type StatusLookup = {
  code: string;
  countsAsPresent?: boolean;
};

function statusCodeByPreference(statuses: StatusLookup[], preferred: readonly string[]): string | null {
  const byUpper = new Map(statuses.map((status) => [status.code.toUpperCase(), status.code]));
  for (const code of preferred) {
    const found = byUpper.get(code.toUpperCase());
    if (found) return found;
  }
  return null;
}

/** Status applied to every student the teacher does not explicitly change. */
export function presentStatusCode(statuses: StatusLookup[]): string | null {
  return (
    statusCodeByPreference(statuses, ['PRESENT', 'P']) ??
    statuses.find((status) => status.countsAsPresent === true)?.code ??
    null
  );
}

export function absentStatusCode(statuses: StatusLookup[]): string | null {
  return (
    statusCodeByPreference(statuses, ['ABSENT', 'A']) ??
    statuses.find((status) => status.countsAsPresent === false)?.code ??
    null
  );
}

export function lateStatusCode(statuses: StatusLookup[]): string | null {
  return statusCodeByPreference(statuses, ['LATE', 'L']);
}

/**
 * Full class roster for one save. Listed marks win; everyone else is Present.
 * Later duplicates for the same enrollment override earlier ones.
 */
export function completeAttendanceRoster(
  enrollmentIds: string[],
  marks: AttendanceRosterMark[],
  presentCode: string,
): AttendanceRosterMark[] {
  const byEnrollment = new Map<string, AttendanceRosterMark>();
  for (const mark of marks) {
    byEnrollment.set(mark.enrollmentId, mark);
  }
  return enrollmentIds.map((enrollmentId) => {
    const existing = byEnrollment.get(enrollmentId);
    if (!existing) return { enrollmentId, statusCode: presentCode };
    return {
      enrollmentId,
      statusCode: existing.statusCode,
      ...(existing.remark !== undefined ? { remark: existing.remark } : {}),
    };
  });
}

export function attendancePercentage(
  marks: Array<{ statusCode: string }>,
  statuses: AttendanceStatusDef[],
): number {
  if (marks.length === 0) return 0;
  const byCode = new Map(statuses.map((s) => [s.code, s]));
  let presentWeight = 0;
  let totalWeight = 0;
  for (const mark of marks) {
    const status = byCode.get(mark.statusCode);
    const weight = status?.weight ?? 1;
    totalWeight += weight;
    if (status?.countsAsPresent) {
      presentWeight += weight;
    }
  }
  if (totalWeight === 0) return 0;
  return Math.round((presentWeight / totalWeight) * 10000) / 100;
}

export function isAttendanceShortage(
  percentage: number,
  thresholdPercent: number,
): boolean {
  return percentage < thresholdPercent;
}
