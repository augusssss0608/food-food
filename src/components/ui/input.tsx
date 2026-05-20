'use client';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  suffix?: ReactNode;
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, suffix, invalid, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? undefined;
  return (
    <label htmlFor={inputId} className="block">
      {label && (
        <span className="block text-[11px] uppercase tracking-[0.14em] text-text-3 mb-1.5 font-medium">
          {label}
        </span>
      )}
      <div
        className={[
          'flex items-center gap-2 h-12 px-3.5 rounded-lg bg-surface border transition-colors',
          invalid
            ? 'border-danger/60 focus-within:border-danger'
            : 'border-hairline focus-within:border-accent/60',
        ].join(' ')}
      >
        <input
          ref={ref}
          id={inputId}
          className={[
            'flex-1 bg-transparent outline-none text-[15px] text-text placeholder:text-text-4',
            'tabular',
            className,
          ].join(' ')}
          {...rest}
        />
        {suffix && <span className="text-text-3 text-[13px]">{suffix}</span>}
      </div>
      {hint && (
        <span className={`block mt-1.5 text-[12px] ${invalid ? 'text-danger' : 'text-text-3'}`}>
          {hint}
        </span>
      )}
    </label>
  );
});

type SelectProps = InputHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: { value: string; label: string }[];
};

export function Select({ label, options, className = '', id, name, ...rest }: SelectProps) {
  const selectId = id ?? name ?? undefined;
  return (
    <label htmlFor={selectId} className="block">
      {label && (
        <span className="block text-[11px] uppercase tracking-[0.14em] text-text-3 mb-1.5 font-medium">
          {label}
        </span>
      )}
      <div className="relative">
        <select
          id={selectId}
          name={name}
          className={[
            'appearance-none w-full h-12 px-3.5 pr-9 rounded-lg bg-surface border border-hairline',
            'text-[15px] text-text outline-none focus:border-accent/60 transition-colors',
            'cursor-pointer',
            className,
          ].join(' ')}
          {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface text-text">{o.label}</option>
          ))}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </label>
  );
}
