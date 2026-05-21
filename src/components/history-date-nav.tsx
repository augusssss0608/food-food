'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * /history/meals 用的日期切換條：
 * - 中間日期區點擊 → 觸發原生 date picker（input type="date"）
 * - max=todayDate 不允許選未來
 * - 「下一日」按鈕在 isToday 時隱藏（只能往過去翻）
 * - 「前一日」永遠可用
 */
export function HistoryDateNav({
  date,
  dateLabel,
  todayDate,
  prevDate,
  nextDate,
  isToday,
}: {
  date: string;
  dateLabel: string;
  todayDate: string;
  prevDate: string;
  nextDate: string;
  isToday: boolean;
}) {
  const router = useRouter();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (!v || v === date) return;
    router.push(`/history/meals?date=${v}`, { scroll: false });
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between bg-surface border border-hairline rounded-xl px-3 py-3">
        <Link
          href={`/history/meals?date=${prevDate}`}
          prefetch
          replace
          aria-label="前一天"
          className="p-2 -ml-1 text-text-2 hover:text-text rounded-md transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        <label className="relative text-center cursor-pointer flex-1">
          <input
            type="date"
            value={date}
            max={todayDate}
            onChange={onPick}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            aria-label="選擇日期"
          />
          <p className="text-[14px] text-text font-medium pointer-events-none">{dateLabel}</p>
          <p className="text-[10px] text-text-3 font-mono tabular mt-0.5 pointer-events-none">
            {date}{isToday && ' · 今天'}
          </p>
        </label>

        {/* 今天 → 下一日按鈕隱藏（用戶要求不能選未來） */}
        {isToday ? (
          <span className="p-2 -mr-1 w-[34px] h-[34px] block" aria-hidden="true" />
        ) : (
          <Link
            href={`/history/meals?date=${nextDate}`}
            prefetch
            replace
            aria-label="後一天"
            className="p-2 -mr-1 text-text-2 hover:text-text rounded-md transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        )}
      </div>

      {/* iOS 原生 date picker 沒法塞「今日」按鈕，加在頁面上 */}
      {!isToday && (
        <div className="flex justify-center mt-2">
          <Link
            href={`/history/meals?date=${todayDate}`}
            prefetch
            replace
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-accent font-mono hover:text-accent-press active:scale-95 transition-all px-3 py-1.5 rounded-md border border-accent/30 bg-accent/10"
          >
            跳至今日
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
