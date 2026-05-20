'use client';
import { useEffect, type ReactNode } from 'react';

/**
 * iOS 風格底部彈出面板。所有 app 內的選擇 / 選項 / 確認類交互都應該走這個，
 * 視覺上跟 iOS native file picker / share sheet 風格統一（都從底部彈出）。
 *
 * - 整定位 + 動畫用 inline style（避開 Tailwind v4 對 fixed/transform arbitrary 值的不確定）
 * - safe-area-inset-bottom 處理 home indicator
 * - 點 overlay 或 ESC 關閉
 */
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 80,
          background: 'rgba(10,10,12,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease-out',
        }}
      />
      <div
        role="dialog"
        aria-hidden={!open}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 81,
          background: 'var(--color-surface-2)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: '1px solid var(--color-hairline)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
          paddingTop: '0.5rem',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* drag handle 視覺暗示 */}
        <div
          style={{
            width: 36, height: 4,
            background: 'var(--color-hairline-strong)',
            borderRadius: 2,
            margin: '6px auto 12px',
          }}
        />
        {children}
      </div>
    </>
  );
}
