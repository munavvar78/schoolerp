import { todayIsoDate } from '@school-erp/shared';

export function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function personName(person: { firstName: string; lastName?: string | null }): string {
  return `${person.firstName} ${person.lastName ?? ''}`.trim();
}

export function isoDateOnly(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function formatPrettyDate(value?: string | null): string {
  const iso = isoDateOnly(value);
  if (!iso) return '';
  const parts = iso.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatPrettyDate(value);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function shiftIsoDate(iso: string, days: number): string {
  const parts = iso.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return todayIsoDate(date);
}

export function rupeesToPaise(input: string): number | null {
  const normalized = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const paise = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(paise) || paise <= 0) return null;
  return paise;
}

const DAY_LABELS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function weekdayName(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`;
}
