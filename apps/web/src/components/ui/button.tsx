import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-slate-800 text-white hover:bg-slate-900',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Shows an inline spinner and disables the control while true. */
  loading?: boolean;
  /** Optional label while loading; defaults to children (keeps width stable). */
  loadingLabel?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      type = 'button',
      loading = false,
      loadingLabel,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:pointer-events-none disabled:opacity-50 print:hidden',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner
            size="sm"
            className={cn(
              'gap-0 [&_span]:border-current [&_span]:border-t-transparent',
              variant === 'outline' || variant === 'ghost'
                ? '[&_span]:border-slate-400 [&_span]:border-t-brand-600'
                : null,
            )}
          />
          <span className="inline-flex min-w-0 items-center">{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  ),
);
Button.displayName = 'Button';
