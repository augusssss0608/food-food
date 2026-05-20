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
 * 今日摘要：4 個指標的進度展示。
 * 用戶要求兩種視覺都做出來比較，先並存：上方環、下方條。挑掉哪邊看實機體感。
 *
 * over-target 處理（codex 收斂）：
 * - ring stroke 視覺仍 clamp 100%（不繞第二圈）
 * - ring center text 顯示「實際」百分比（如 118%），文字 warm
 * - bar fill 滿格、文字 warm，bar 顏色維持避免四欄都同色辨識度下降
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

      {/* Rings — 上方 */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {metrics.map((m) => <RingCard key={m.key} m={m} />)}
      </div>

      {/* Bars — 下方 */}
      <div className="bg-surface border border-hairline rounded-xl px-4 py-3 space-y-3">
        {metrics.map((m) => <BarRow key={m.key} m={m} />)}
      </div>
    </section>
  );
}

function RingCard({ m }: { m: Metric }) {
  const pctRaw = m.target > 0 ? (m.consumed / m.target) * 100 : 0;
  const pctVisual = Math.min(100, pctRaw); // ring stroke 不繞第二圈
  const pctDisplay = Math.round(pctRaw);   // 中心文字顯示實際值
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
        {Math.round(m.consumed)}<span className="text-text-4">/{m.target}</span>
      </p>
    </div>
  );
}

function BarRow({ m }: { m: Metric }) {
  const pctRaw = m.target > 0 ? (m.consumed / m.target) * 100 : 0;
  const pctVisual = Math.min(100, pctRaw);
  const remaining = Math.max(0, m.target - m.consumed);
  const over = pctRaw > 100;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[12px] uppercase tracking-wide text-text-3 font-mono">{m.label}</span>
        <span className={`text-[11px] tabular font-mono ${over ? 'text-warm' : 'text-text-2'}`}>
          {Math.round(m.consumed)}<span className="text-text-4">/{m.target}{m.unit}</span>
          {' · '}
          {over ? (
            <span>超 {Math.round(m.consumed - m.target)}{m.unit}</span>
          ) : (
            <span className="text-text-4">差 {Math.round(remaining)}{m.unit}</span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pctVisual}%`, background: m.color }}
        />
      </div>
    </div>
  );
}
