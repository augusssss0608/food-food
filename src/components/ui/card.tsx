import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  raised?: boolean;
};

export function Card({ children, raised = false, className = '', ...rest }: Props) {
  return (
    <div
      className={[
        'rounded-2xl border border-hairline',
        raised ? 'bg-surface-2' : 'bg-surface',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-5 pt-5 pb-2 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-medium mb-3">
      {children}
    </h2>
  );
}
