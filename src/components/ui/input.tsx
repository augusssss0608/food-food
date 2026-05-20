'use client';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { BottomSheet } from './bottom-sheet';

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

type SelectOption = { value: string; label: string };

type SelectProps = {
  id?: string;
  label?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
};

/**
 * Custom select that 用底部 bottom sheet 替代 iOS native `<select>` popover。
 * 好處：所有「選擇類」交互統一從底部彈出（跟 iOS file picker 同位置同風格）。
 */
export function Select({ id, label, value, onValueChange, options, placeholder }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <div className="block">
        {label && (
          <label
            htmlFor={id}
            className="block text-[11px] uppercase tracking-[0.14em] text-text-3 mb-1.5 font-medium"
          >
            {label}
          </label>
        )}
        <button
          id={id}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={[
            'w-full h-12 px-3.5 rounded-lg bg-surface border border-hairline',
            'flex items-center justify-between text-[15px] outline-none',
            'focus:border-accent/60 transition-colors text-left',
          ].join(' ')}
        >
          <span className={selected ? 'text-text' : 'text-text-4'}>
            {selected?.label ?? placeholder ?? '請選擇'}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-text-3"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        {label && (
          <div className="text-center text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-1 pb-2 border-b border-hairline">
            {label}
          </div>
        )}
        <div className="pb-2">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onValueChange?.(opt.value);
                  setOpen(false);
                }}
                className={[
                  'w-full px-5 py-4 text-[16px] flex items-center justify-between',
                  'transition-colors',
                  isSelected
                    ? 'text-accent'
                    : 'text-text active:bg-surface-3',
                ].join(' ')}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
