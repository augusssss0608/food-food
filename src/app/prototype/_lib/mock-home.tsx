'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { MOCK_TODAY_LOG, type TodayLogEntry } from './mock-presets';

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * 提供一個 hook 給 variant 管 today log state，模擬「真實主頁」。
 * variant 內呼 addEntry 即可讓 MockHome 真的多一筆。
 */
export function useMockTodayLog() {
  const [log, setLog] = useState<TodayLogEntry[]>(MOCK_TODAY_LOG);
  function addEntry(name: string, kcal: number) {
    setLog((prev) => [...prev, { id: `l-${Date.now()}-${Math.random()}`, ate_at: new Date().toISOString(), dish_name: name, kcal }]);
  }
  return { log, addEntry };
}

/**
 * 共用的「假主頁」骨架。
 */
export function MockHome({
  log,
  rightAction,
  todayLogExtraSlot,
  scrollPaddingBottom = 16,
}: {
  log: TodayLogEntry[];
  rightAction?: ReactNode;
  todayLogExtraSlot?: ReactNode;
  scrollPaddingBottom?: number;
}) {
  const total = log.reduce((s, m) => s + m.kcal, 0);
  return (
    <div
      className="h-full overflow-y-auto"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)', paddingBottom: `${scrollPaddingBottom}px` }}
    >
      <div className="max-w-md mx-auto px-5">
        <header className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-1">today · 5/22</p>
            <h1 className="display-roman text-[32px] leading-none">food <span className="display">·</span> food</h1>
          </div>
          <div className="flex-shrink-0">{rightAction}</div>
        </header>

        <section className="mb-5 bg-surface border border-hairline rounded-xl px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono mb-1.5">今日攝入</p>
          <p className="text-[22px] font-mono tabular text-text font-medium">
            {total}<span className="text-[12px] text-text-3 ml-1.5">/ 2200 kcal</span>
          </p>
        </section>

        <section className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-3">今日紀錄 · {log.length} 筆</p>
          <ul className="space-y-1.5">
            {log.map((m) => (
              <li
                key={m.id}
                className="bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-text font-medium truncate">{m.dish_name}</p>
                  <p className="text-[10px] text-text-4 font-mono mt-0.5">{fmtTime(m.ate_at)}</p>
                </div>
                <p className="text-[13px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
              </li>
            ))}
            {todayLogExtraSlot}
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * 半透明遮罩 + 從底升起的半彈窗。
 * - body 鎖滾
 * - ESC / overlay 點擊關閉
 * - 內容區可滾動
 */
export function MockSheet({
  open,
  onClose,
  title,
  children,
  minHeight = '50vh',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  minHeight?: string;
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
      <div
        onClick={onClose}
        className="fixed inset-0 z-[70] transition-opacity duration-200"
        style={{
          background: 'rgba(10,10,12,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />
      <aside
        role="dialog"
        aria-hidden={!open}
        className="fixed left-0 right-0 bottom-0 z-[71] flex flex-col"
        style={{
          background: 'var(--color-surface-2)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: '1px solid var(--color-hairline)',
          maxHeight: 'calc(100dvh - 4rem)',
          minHeight,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
        }}
      >
        <div className="relative flex-shrink-0 px-5 h-12 flex items-center justify-center border-b border-hairline">
          <div className="w-10 h-1 bg-text-3/40 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
          {title && <span className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-medium mt-2">{title}</span>}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}

/**
 * 主頁右上「+」按鈕（保真模擬 home-content 的 add meal 入口）。
 */
export function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="add meal"
      className="p-2 -mr-2 active:scale-95 transition-all rounded-md text-accent hover:text-accent-press"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

/**
 * 統一的 toast：固定位置 + 自動消失。
 */
export function MockToast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bg-accent text-accent-ink px-5 py-2.5 rounded-full text-[13px] font-medium shadow-lg z-[200] animate-pulse"
      style={{ top: 'calc(env(safe-area-inset-top) + 60px)' }}
    >
      ✓ {text}
    </div>
  );
}
