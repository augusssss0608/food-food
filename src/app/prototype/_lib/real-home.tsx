'use client';
import { type ReactNode } from 'react';
import type { TodayMeal } from '@/components/today-meals';

const fmtTime = (iso: string, tz: string) => new Date(iso).toLocaleTimeString('zh-TW', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
});

/**
 * 簡化的「真實主頁」骨架：今日攝入摘要 + 今日紀錄列表。
 * 用真實數據（meals 從 SWR），每個 prototype variant 把 add-meal 入口
 * 放在這個 shell 之外（fixed FAB / shelf / overlay）或者 inline 注入 todayLogExtraSlot。
 */
export function RealHomeShell({
  meals,
  timezone,
  rightAction,
  todayLogExtraSlot,
  scrollPaddingBottom = 24,
}: {
  meals: TodayMeal[];
  timezone: string;
  rightAction?: ReactNode;
  todayLogExtraSlot?: ReactNode;
  scrollPaddingBottom?: number;
}) {
  const total = meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const todayLabel = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)', paddingBottom: `${scrollPaddingBottom}px` }}
    >
      <div className="max-w-md mx-auto px-5">
        <header className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-1">today · {todayLabel}</p>
            <h1 className="display-roman text-[32px] leading-none">food <span className="display">·</span> food</h1>
          </div>
          <div className="flex-shrink-0">{rightAction}</div>
        </header>

        <section className="mb-5 bg-surface border border-hairline rounded-xl px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono mb-1.5">今日攝入</p>
          <p className="text-[22px] font-mono tabular text-text font-medium">
            {Math.round(total)}<span className="text-[12px] text-text-3 ml-1.5">/ 2200 kcal</span>
          </p>
        </section>

        <section className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-3">今日紀錄 · {meals.length} 筆</p>
          {meals.length === 0 ? (
            <div className="bg-surface border border-hairline rounded-lg px-3.5 py-6 text-center">
              <p className="text-[12px] text-text-3">沒有紀錄</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {meals.map((m) => (
                <li
                  key={m.id}
                  className="bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-text font-medium truncate">{m.dish_name ?? '未命名'}</p>
                    <p className="text-[10px] text-text-4 font-mono mt-0.5">{fmtTime(m.ate_at, timezone)}</p>
                  </div>
                  <p className="text-[13px] font-mono text-accent tabular">
                    {m.kcal == null ? '—' : Math.round(m.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {todayLogExtraSlot}
        </section>
      </div>
    </div>
  );
}
