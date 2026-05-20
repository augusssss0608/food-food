'use client';
import { useMemo } from 'react';
import { SectionLabel } from './ui/card';

type Metric = {
  key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g';
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
};

/**
 * 今日摘要：4 個指標環（kcal / 蛋白 / 碳水 / 脂肪）。
 * over-target：ring stroke clamp 100% 不繞第二圈，center text 顯示實際 % 並 warm 色。
 * 全部 target = 0 → 顯示「請先選擇今日狀態」提示，不畫空環。
 */
export function TodaySummary({
  consumed,
  targets,
  workoutHint,
}: {
  consumed: { kcal: number; protein_g: number; carb_g: number; fat_g: number };
  targets: { kcal: number; protein_g: number; carb_g: number; fat_g: number };
  workoutHint?: string;
}) {
  const metrics: Metric[] = useMemo(() => [
    { key: 'kcal', label: 'kcal', consumed: consumed.kcal, target: targets.kcal, unit: '', color: '#c8ff00' },
    { key: 'protein_g', label: '蛋白', consumed: consumed.protein_g, target: targets.protein_g, unit: 'g', color: '#ff7a45' },
    { key: 'carb_g', label: '碳水', consumed: consumed.carb_g, target: targets.carb_g, unit: 'g', color: '#dcff3a' },
    { key: 'fat_g', label: '脂肪', consumed: consumed.fat_g, target: targets.fat_g, unit: 'g', color: '#a4a4ac' },
  ], [consumed, targets]);

  // 沒有任何 target → 用戶還沒選 workout/rest → 顯示提示而不是 0/0 環
  const allZero = metrics.every((m) => m.target <= 0);

  return (
    <section className="mb-7">
      <div className="flex items-baseline justify-between mb-3">
        <SectionLabel>今日摘要</SectionLabel>
        {workoutHint && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-4 font-mono">
            {workoutHint}
          </span>
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
