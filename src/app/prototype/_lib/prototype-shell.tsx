'use client';
import Link from 'next/link';
import { type ReactNode } from 'react';

/**
 * 簡單 wrapper，子層 h-full 能正確繼承 100dvh。
 * 「← 索引」chip fixed 浮在最上層。
 */
export function PrototypeShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-ink text-text relative" style={{ height: '100dvh' }}>
      <div className="w-full h-full">{children}</div>
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
