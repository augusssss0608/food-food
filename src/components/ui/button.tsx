'use client';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leading?: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-press active:bg-accent-press disabled:bg-surface-3 disabled:text-text-3',
  secondary:
    'bg-surface-2 text-text border border-hairline hover:bg-surface-3 hover:border-hairline-strong disabled:opacity-50',
  ghost:
    'bg-transparent text-text-2 hover:text-text hover:bg-surface-2 disabled:opacity-40',
  danger:
    'bg-transparent text-danger border border-danger/30 hover:bg-danger/10 hover:border-danger/60 disabled:opacity-40',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-11 px-4 text-[14px] gap-2 rounded-lg',
  lg: 'h-14 px-6 text-[15px] gap-2.5 rounded-xl tracking-tight',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, leading, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center font-medium transition-colors',
        'transition-transform duration-150 ease-out active:scale-[0.985] disabled:active:scale-100',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 16 : 14} /> : leading}
      <span>{children}</span>
    </button>
  );
});
