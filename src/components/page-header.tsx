'use client';
import { useState, type ReactNode } from 'react';
import { AppDrawer } from './app-drawer';

/**
 * 所有頁面共享的 header：左漢堡（打開全局 drawer）+ 可選 rightAction（如主頁的「+」按鈕）。
 * 取代所有頁面原本的「← 主頁」back link — 用戶要求改成統一 drawer 入口。
 *
 * 用法：
 *   <PageHeader rightAction={<button>+</button>}>
 *     <p>subtitle</p>
 *     <h1>title</h1>
 *   </PageHeader>
 */
export function PageHeader({
  children,
  rightAction,
}: {
  children?: ReactNode;
  rightAction?: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <>
      <header className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="open menu"
            className="p-2 -ml-2 text-text-2 hover:text-text active:scale-95 transition-all rounded-md"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="13" x2="20" y2="13" />
              <line x1="4" y1="19" x2="14" y2="19" />
            </svg>
          </button>
          {rightAction}
        </div>
        {children}
      </header>
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
