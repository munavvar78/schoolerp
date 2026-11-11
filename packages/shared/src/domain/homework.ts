import type { HomeworkStatus } from '../constants.js';

export function resolveHomeworkStatus(
  dueDate: Date,
  asOf: Date,
  current: HomeworkStatus,
  graceDays = 0,
): HomeworkStatus {
  if (current === 'CHECKED' || current === 'SUBMITTED') return current;
  const msPerDay = 24 * 60 * 60 * 1000;
  const dueEnd = new Date(dueDate);
  dueEnd.setHours(23, 59, 59, 999);
  const graceMs = graceDays * msPerDay;
  if (asOf.getTime() > dueEnd.getTime() + graceMs) return 'LATE';
  return current === 'LATE' ? 'ASSIGNED' : current;
}
