'use client';
import { useEffect, type ReactNode } from 'react';
import { Button } from './button';

type Props = {
  open: boolean;
  title: string;
  body?: ReactNode;
  onCancel?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  busy?: boolean;
};

export function Dialog({
  open, title, body,
  onCancel, onConfirm,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  busy = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) onCancel();
      if (e.key === 'Enter' && onConfirm && !busy) onConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm, busy]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={onCancel}
        style={{ animation: 'ff-fade-in 0.18s ease-out both' }}
      />
      <div
        className="relative w-full max-w-sm bg-surface-2 border border-hairline rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
        style={{ animation: 'ff-dialog-in 0.28s var(--ease-spring) both' }}
      >
        <div className="px-5 pt-5 pb-4">
          <h3 className="display-roman text-[22px] leading-tight text-text">{title}</h3>
          {body && <div className="mt-3 text-[14px] text-text-2 leading-relaxed">{body}</div>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          {onCancel && (
            <Button variant="secondary" size="md" onClick={onCancel} className="flex-1" disabled={busy}>
              {cancelText}
            </Button>
          )}
          {onConfirm && (
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="md"
              onClick={onConfirm}
              loading={busy}
              className="flex-1"
            >
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
