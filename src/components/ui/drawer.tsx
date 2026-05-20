'use client';
import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// drawer 打開時立即 prefetch 這幾個目標，讓首次點擊用 RSC cache 瞬切。
// 不 prefetch /admin/debug：force-dynamic + 5 個 Supabase 查詢，太重且低頻。
const PREFETCH_ON_OPEN = ['/settings', '/setup', '/inbox'];

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
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // drawer 一打開就立即 prefetch 常用目標的 RSC payload，等用戶點 item 已在 cache 裡
    for (const href of PREFETCH_ON_OPEN) router.prefetch(href);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, router]);

  return (
    <>
      {/* overlay：輕度 dim，主畫面仍可見 */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(10,10,12,0.35)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease-out',
        }}
      />
      {/*
        drawer 用全 inline style 寫死定位 / 尺寸 / transform，避開 Tailwind v4 對
        `w-[min(320px,86vw)]`、`translate-x-full`、`transform` 工具類解析失敗的可能。
        關閉時 translateX(100%)，drawer 整體在 viewport 右側外，不會半截露出來。
      */}
      <aside
        aria-hidden={!open}
        className="bg-surface border-r border-hairline shadow-2xl shadow-black/60 flex flex-col"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 50,
          height: '100dvh',
          width: 'min(320px, 86vw)',
          // 漢堡在左 → 抽屜從左滑入；關閉時 translateX(-100%) 整體在 viewport 左側外
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* drawer header：只剩標籤，點 overlay / 點 item 跳轉都會自動關閉，不需要 ✕ 按鈕 */}
        <div className="flex items-center px-5 h-14 border-b border-hairline flex-shrink-0">
          <span className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-medium">
            {title ?? 'Menu'}
          </span>
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
    // 用 next/link 替代 <a>，next.js 客戶端瞬切，不再 MPA 全頁重載。
    // replace = true：不留可右滑回退的 history entry（防 iOS swipe-back，見
    // no-swipe-back-gesture.tsx 對應策略）。
    return <Link href={href} prefetch replace className={className} onClick={onClick}>{inner}</Link>;
  }
  return <button onClick={onClick} className={className}>{inner}</button>;
}
