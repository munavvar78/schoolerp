import { cn } from '@/lib/utils';

type SpinnerProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

const sizes = {
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-4 w-4 border-2',
  lg: 'h-8 w-8 border-[3px]',
} as const;

/** Teal/slate ring spinner used for pending actions and page loads. */
export function Spinner({ className, size = 'md', label }: SpinnerProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Loading'}
    >
      <span
        className={cn(
          'inline-block shrink-0 animate-spin rounded-full border-slate-300 border-t-brand-600',
          sizes[size],
        )}
        aria-hidden
      />
      {label ? <span className="text-sm text-slate-600">{label}</span> : null}
    </span>
  );
}

/** Soft full-viewport veil for longer mutating requests (create exam, etc.). */
export function BusyOverlay({
  open,
  label = 'Working…',
}: {
  open: boolean;
  label?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 backdrop-blur-[1px]"
      role="alertdialog"
      aria-busy="true"
      aria-live="assertive"
      aria-label={label}
    >
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-lg">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-800">{label}</p>
      </div>
    </div>
  );
}
