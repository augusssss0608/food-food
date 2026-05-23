import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">Twin Horizontal</h1>
        <p className="text-[13px] text-text-3 mt-2">
          半彈窗 · 上下兩層橫向滑動 · 1.2s 停留自動提交切換。
        </p>
      </header>
      <ul className="space-y-2.5">
        <li>
          <Link
            href="/prototype/v33-twin-h"
            className="block bg-surface border border-accent/30 rounded-xl px-4 py-3.5 hover:border-accent/60 hover:bg-surface-2 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <p className="text-[14px] font-medium text-text">Twin Horizontal 雙橫向</p>
              <p className="text-[10px] font-mono text-accent/80 uppercase tracking-wider">cover-flow</p>
            </div>
            <p className="text-[12px] text-text-3 leading-snug">
              上方 mode 橫向 segmented + 下方 preset 橫向 cover-flow。按鈕 = 橫向刻度 + 居中圓點。
            </p>
          </Link>
        </li>
      </ul>
    </div>
  );
}
