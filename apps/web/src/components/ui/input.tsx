import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <label className="block space-y-1.5 text-sm">
        {label ? <span className="font-medium text-slate-700">{label}</span> : null}
        <input ref={ref} id={inputId} className={cn(fieldClass, error && 'border-rose-400', className)} {...props} />
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
        {!error && hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </label>
    );
  },
);
Input.displayName = 'Input';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, id, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <label className="block space-y-1.5 text-sm">
        {label ? <span className="font-medium text-slate-700">{label}</span> : null}
        <select ref={ref} id={selectId} className={cn(fieldClass, error && 'border-rose-400', className)} {...props}>
          {children}
        </select>
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </label>
    );
  },
);
Select.displayName = 'Select';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const areaId = id ?? props.name;
    return (
      <label className="block space-y-1.5 text-sm">
        {label ? <span className="font-medium text-slate-700">{label}</span> : null}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(fieldClass, 'min-h-[88px]', error && 'border-rose-400', className)}
          {...props}
        />
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </label>
    );
  },
);
Textarea.displayName = 'Textarea';
