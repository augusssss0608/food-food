'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

/**
 * 主頁今日狀態：訓練日 / 休息日 切換。
 * 點任一鈕 → POST /api/workout-day upsert → router.refresh 拉新目標。
 * 未標記時兩鈕都不亮，下面顯示提示文案。
 */
export function WorkoutDayToggle({
  date,
  workoutMarked,
  isWorkoutDay,
}: {
  date: string;
  workoutMarked: boolean;
  isWorkoutDay: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<'workout' | 'rest' | null>(null);

  async function setWorkout(is_workout: boolean) {
    setBusy(is_workout ? 'workout' : 'rest');
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
      router.refresh();
    } catch (e: unknown) {
      toast.error('設定失敗', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const workoutSelected = workoutMarked && isWorkoutDay;
  const restSelected = workoutMarked && !isWorkoutDay;

  return (
    <section className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-2">今日狀態</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setWorkout(true)}
          disabled={busy != null}
          className={[
            'relative flex-1 h-10 rounded-lg text-[14px] font-medium transition-colors',
            'disabled:opacity-60',
            workoutSelected
              ? 'bg-accent text-accent-ink'
              : 'bg-surface border border-hairline text-text-2 hover:border-hairline-strong',
          ].join(' ')}
        >
          {busy === 'workout' ? (
            <span className="inline-flex items-center gap-2"><Spinner size={12} /> 訓練日</span>
          ) : '訓練日'}
        </button>
        <button
          type="button"
          onClick={() => setWorkout(false)}
          disabled={busy != null}
          className={[
            'relative flex-1 h-10 rounded-lg text-[14px] font-medium transition-colors',
            'disabled:opacity-60',
            restSelected
              ? 'bg-text-2 text-ink'
              : 'bg-surface border border-hairline text-text-2 hover:border-hairline-strong',
          ].join(' ')}
        >
          {busy === 'rest' ? (
            <span className="inline-flex items-center gap-2"><Spinner size={12} /> 休息日</span>
          ) : '休息日'}
        </button>
      </div>
      {!workoutMarked && (
        <p className="text-[11px] text-text-4 font-mono mt-2">未選擇，今日目標顯示 0</p>
      )}
    </section>
  );
}
