'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { useDeferredRefresh } from '@/components/use-deferred-refresh';

/**
 * 主頁今日狀態：訓練日 / 休息日 切換。
 * 點任一鈕 → POST /api/workout-day upsert → router.refresh 拉新目標。
 * 用戶要求：標記後整個 toggle 行消失（切換改由 TodaySummary 右上標籤按鈕觸發）。
 *
 * 樂觀 UI（codex round A 反饋）：POST 一發出就把本地 marked 設 true，toggle 立即消失，
 * 不必等 server refresh 回來。失敗時回滾本地狀態。
 */
export function WorkoutDayToggle({
  date,
  workoutMarked,
}: {
  date: string;
  workoutMarked: boolean;
}) {
  const deferredRefresh = useDeferredRefresh();
  const toast = useToast();
  const [busy, setBusy] = useState<'workout' | 'rest' | null>(null);
  const [optimisticMarked, setOptimisticMarked] = useState(workoutMarked);

  // server prop 變更（refresh 回來）時同步本地
  useEffect(() => {
    setOptimisticMarked(workoutMarked);
  }, [workoutMarked]);

  // 已標記（或樂觀標記）→ 隱藏整個 toggle 行
  if (optimisticMarked) return null;

  async function setWorkout(is_workout: boolean) {
    setBusy(is_workout ? 'workout' : 'rest');
    setOptimisticMarked(true); // 樂觀隱藏 toggle，不等 server
    try {
      const r = await fetch('/api/workout-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify({ date, is_workout }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      deferredRefresh();
    } catch (e: unknown) {
      setOptimisticMarked(false); // 失敗 → 回滾，讓 toggle 重新顯示
      toast.error('設定失敗', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-2">今日狀態</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setWorkout(true)}
          disabled={busy != null}
          className="relative flex-1 h-10 rounded-lg text-[14px] font-medium transition-colors disabled:opacity-60 bg-surface border border-hairline text-text-2 hover:border-hairline-strong"
        >
          {busy === 'workout' ? (
            <span className="inline-flex items-center gap-2"><Spinner size={12} /> 訓練日</span>
          ) : '訓練日'}
        </button>
        <button
          type="button"
          onClick={() => setWorkout(false)}
          disabled={busy != null}
          className="relative flex-1 h-10 rounded-lg text-[14px] font-medium transition-colors disabled:opacity-60 bg-surface border border-hairline text-text-2 hover:border-hairline-strong"
        >
          {busy === 'rest' ? (
            <span className="inline-flex items-center gap-2"><Spinner size={12} /> 休息日</span>
          ) : '休息日'}
        </button>
      </div>
      <p className="text-[11px] text-text-4 font-mono mt-2">未選擇，今日目標顯示 0</p>
    </section>
  );
}
