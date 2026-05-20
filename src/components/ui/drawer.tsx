'use client';
import { useEffect, type ReactNode } from 'react';

export function Drawer({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <>
      {/* overlay — 輕度 dim（35%），主畫面仍可見；不做 backdrop-blur */}
      <div
        aria-hidden={!open}
        className={[
          'fixed inset-0 z-40 bg-ink/35 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />
      <aside
        aria-hidden={!open}
        className={[
          // 改用 w-80 + max-w-[86vw]，避開 Tailwind v4 對 w-[min(...)] 解析的不確定
          // 同時用內聯 style 把 right:0 / width 寫死，雙重保險
          'fixed top-0 z-50 h-dvh w-80 max-w-[86vw] bg-surface border-l border-hairline shadow-2xl shadow-black/60',
          'flex flex-col',
          'transform transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{
          right: 0,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-hairline flex-shrink-0">
          <span className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-medium">
            {title ?? 'Menu'}
          </span>
          <button
            onClick={onClose}
            aria-label="close menu"
            className="p-1.5 -mr-1.5 text-text-3 hover:text-text rounded-md transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}

export function DrawerItem({
  icon, label, hint, onClick, href, danger,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = [
    'w-full flex items-center gap-3 px-5 py-4 border-b border-hairline text-left',
    'hover:bg-surface-2 transition-colors',
    danger ? 'text-danger' : 'text-text',
  ].join(' ');
  const inner = (
    <>
      <span className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${danger ? 'bg-danger/10' : 'bg-surface-2'}`}>
        {icon}
      </span>
      {/* truncate 兜底：即便容器寬度算錯也不會跑出邊 */}
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium leading-tight truncate">{label}</span>
        {hint && <span className="block text-[12px] text-text-3 mt-0.5 truncate">{hint}</span>}
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-text-3 flex-shrink-0">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </>
  );
  if (href) {
    return <a href={href} className={className} onClick={onClick}>{inner}</a>;
  }
  return <button onClick={onClick} className={className}>{inner}</button>;
}
