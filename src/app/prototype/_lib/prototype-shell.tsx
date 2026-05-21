'use client';
import Link from 'next/link';
import { type ReactNode } from 'react';

/**
 * 所有 prototype variant 頁的共用外殼。
 * - 頂部一條返回索引條（含當前 variant 標題）
 * - 內容區留給 variant 自定，不強加 PageShell（很多方案要全屏體驗）
 */
export function PrototypeShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink text-text flex flex-col">
      <header className="px-4 h-12 flex items-center justify-between border-b border-hairline flex-shrink-0">
        <Link href="/prototype" className="flex items-center gap-1.5 text-text-3 hover:text-text active:scale-95 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-[12px] font-mono uppercase tracking-wider">索引</span>
        </Link>
        <div className="text-center">
          <p className="text-[13px] font-medium text-text leading-none">{title}</p>
          {subtitle && <p className="text-[10px] text-text-3 font-mono mt-0.5">{subtitle}</p>}
        </div>
        <div className="w-12" />
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
