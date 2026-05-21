'use client';
import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

/**
 * 主頁今日狀態：訓練日 / 休息日 切換（首次標記）。
 *
 * 不再自己 fetch — 改成呼叫 parent 提供的 onSetWorkoutDay(isWorkout)。
 * 父層用 SWR mutate 更新 cache，UI 立即同步。
 *
 * 標記後該行隱藏，後續切換交給 TodaySummary 右上標籤觸發。
 */
export function WorkoutDayToggle({
  workoutMarked,
  onSetWorkoutDay,
  busy,
}: {
  workoutMarked: boolean;
  onSetWorkoutDay: (isWorkout: boolean) => Promise<boolean>;
  busy: boolean;
}) {
  const [localBusy, setLocalBusy] = useState<'workout' | 'rest' | null>(null);

  if (workoutMarked) return null;

  async function setWorkout(is_workout: boolean) {
    if (busy || localBusy != null) return;
    setLocalBusy(is_workout ? 'workout' : 'rest');
    try {
      await onSetWorkoutDay(is_workout);
    } finally {
      setLocalBusy(null);
    }
  }

  const disabled = busy || localBusy != null;

  return (
    <section className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-2">今日狀態</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setWorkout(true)}
          disabled={disabled}
          className="relative flex-1 h-10 rounded-lg text-[14px] font-medium transition-colors disabled:opacity-60 bg-surface border border-hairline text-text-2 hover:border-hairline-strong"
        >
          {localBusy === 'workout' ? (
            <span className="inline-flex items-center gap-2"><Spinner size={12} /> 訓練日</span>
          ) : '訓練日'}
        </button>
        <button
          type="button"
          onClick={() => setWorkout(false)}
          disabled={disabled}
          className="relative flex-1 h-10 rounded-lg text-[14px] font-medium transition-colors disabled:opacity-60 bg-surface border border-hairline text-text-2 hover:border-hairline-strong"
        >
          {localBusy === 'rest' ? (
            <span className="inline-flex items-center gap-2"><Spinner size={12} /> 休息日</span>
          ) : '休息日'}
        </button>
      </div>
      <p className="text-[11px] text-text-4 font-mono mt-2">未選擇，今日目標顯示 0</p>
    </section>
  );
}
