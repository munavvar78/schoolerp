import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { todayIsoDate as sharedTodayIsoDate } from '@school-erp/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Local calendar date (YYYY-MM-DD) — avoids UTC off-by-one near midnight IST. */
export function todayIsoDate(): string {
  return sharedTodayIsoDate();
}
