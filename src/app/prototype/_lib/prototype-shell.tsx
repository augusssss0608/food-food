'use client';
import Link from 'next/link';
import { type ReactNode } from 'react';

/**
 * 所有 prototype variant 頁的共用外殼。
 * 為了「保真」每個方案的真實環境（半彈窗 / 主屏 FAB / 主屏 shelf / 全屏 deck 等），
 * 這裡只放一個浮動的「← 索引」chip，**不占用任何排版空間**。
 * variant 自己處理 safe-area-inset-top 與內容佈局。
 */
export function PrototypeShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="h-dvh bg-ink text-text relative flex flex-col">
      <div className="flex-1 min-h-0 relative">{children}</div>
      <Link
        href="/prototype"
        className="fixed left-3 z-[200] px-2.5 py-1 rounded-full bg-surface-2/80 backdrop-blur border border-hairline text-text-2 hover:text-text active:scale-95 transition-all flex items-center gap-1.5"
        style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="text-[10px] font-mono uppercase tracking-wider">索引 · {title}</span>
      </Link>
    </div>
  );
}
