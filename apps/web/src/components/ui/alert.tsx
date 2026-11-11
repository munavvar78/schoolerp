import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

export function ErrorAlert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn('rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700', className)}
      {...props}
    />
  );
}

export function SuccessAlert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={cn('rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700', className)}
      {...props}
    />
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-6 text-sm text-slate-500" aria-busy="true">
      <Spinner size="md" />
      {label}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-slate-500">{label}</p>;
}
