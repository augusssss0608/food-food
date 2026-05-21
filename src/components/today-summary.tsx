'use client';
import { useMemo, useState } from 'react';
import { SectionLabel } from './ui/card';
import { Dialog } from './ui/dialog';
import { useToast } from './ui/toast';
import { useDeferredRefresh } from './use-deferred-refresh';

type Metric = {
  key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g';
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
};

/**
 * 今日摘要：4 個指標環。
 *
 * 「訓練日 / 休息日」標籤行為（用戶要求）：
 *   - workoutMarked = false：右上不顯示標籤（toggle 在主頁另一處顯示）
 *   - workoutMarked = true：右上顯示「訓練日 / 休息日」按鈕，點擊 → Dialog 確認 → 切換到另一種
 *
 * 全部 target = 0 → 顯示「請先選擇今日狀態」提示，不畫空環。
 */
export function TodaySummary({
  consumed,
  targets,
  workoutMarked,
  isWorkoutDay,
  todayDate,
}: {
  consumed: { kcal: number; protein_g: number; carb_g: number; fat_g: number };
  targets: { kcal: number; protein_g: number; carb_g: number; fat_g: number };
  workoutMarked: boolean;
  isWorkoutDay: boolean;
  todayDate: string;
}) {
  const deferredRefresh = useDeferredRefresh();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const metrics: Metric[] = useMemo(() => [
    { key: 'kcal', label: 'kcal', consumed: consumed.kcal, target: targets.kcal, unit: '', color: '#c8ff00' },
    { key: 'protein_g', label: '蛋白', consumed: consumed.protein_g, target: targets.protein_g, unit: 'g', color: '#ff7a45' },
    { key: 'carb_g', label: '碳水', consumed: consumed.carb_g, target: targets.carb_g, unit: 'g', color: '#dcff3a' },
    { key: 'fat_g', label: '脂肪', consumed: consumed.fat_g, target: targets.fat_g, unit: 'g', color: '#a4a4ac' },
  ], [consumed, targets]);

  const allZero = metrics.every((m) => m.target <= 0);
  const currentLabel = isWorkoutDay ? '訓練日' : '休息日';
  const otherLabel = isWorkoutDay ? '休息日' : '訓練日';

  async function doSwitch() {
    setBusy(true);
    try {
      const r = await fetch('/api/workout-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify({ date: todayDate, is_workout: !isWorkoutDay }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setConfirmOpen(false);
      deferredRefresh();
    } catch (e: unknown) {
      toast.error('切換失敗', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-7">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>今日摘要</SectionLabel>
        {workoutMarked && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label={`切換到${otherLabel}`}
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-text-2 font-mono bg-surface-2 border border-hairline hover:border-hairline-strong hover:text-text active:scale-95 transition-all px-2.5 py-1 rounded-md"
          >
            {currentLabel}
            {/* 雙向箭頭：暗示「可切換」 */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16l-4-4 4-4M3 12h13M17 8l4 4-4 4M21 12H8" />
            </svg>
          </button>
        )}
      </div>

      {allZero ? (
        <div className="bg-surface border border-hairline rounded-xl px-5 py-6 text-center">
          <p className="text-[13px] text-text-3">請先選擇今日狀態</p>
          <p className="text-[11px] text-text-4 mt-1">標記訓練日或休息日後算目標</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {metrics.map((m) => <RingCard key={m.key} m={m} />)}
        </div>
      )}

      <Dialog
        open={confirmOpen}
        title={`切換到${otherLabel}？`}
        body={`今日已標記為${currentLabel}，確認切換到${otherLabel}並重算目標？`}
        confirmText="切換"
        cancelText="取消"
        onConfirm={doSwitch}
        onCancel={() => setConfirmOpen(false)}
        busy={busy}
      />
    </section>
  );
}

function RingCard({ m }: { m: Metric }) {
  const pctRaw = m.target > 0 ? (m.consumed / m.target) * 100 : 0;
  const pctVisual = Math.min(100, pctRaw);
  const pctDisplay = Math.round(pctRaw);
  const over = pctRaw > 100;
  const radius = 24;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pctVisual / 100) * circ;

  return (
    <div className="flex flex-col items-center bg-surface border border-hairline rounded-xl py-3 px-1">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={radius} fill="none" stroke="var(--color-hairline)" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={radius} fill="none"
          stroke={over ? 'var(--color-warm)' : m.color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 30 30)"
        />
        <text
          x="30" y="34"
          textAnchor="middle"
          className="font-mono"
          fontSize="12"
          fontWeight="600"
          fill={over ? 'var(--color-warm)' : 'var(--color-text)'}
        >
          {pctDisplay}%
        </text>
      </svg>
      <p className="text-[10px] uppercase tracking-wide text-text-3 font-mono mt-1">{m.label}</p>
      <p className="text-[10px] tabular text-text-4 font-mono">
        {Math.round(m.consumed)}{m.unit}<span className="text-text-4">/{m.target}{m.unit}</span>
      </p>
    </div>
  );
}
