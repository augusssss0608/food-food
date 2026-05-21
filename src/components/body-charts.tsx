'use client';
import { DateTime } from 'luxon';

/**
 * 三種體重 / 體脂類數值的可視化變體，並排放在 /history/body 給用戶比較。
 *
 * 共用輸入：series = [{ date, value }]，value 可為 null（該天沒測）。
 * 共用視覺：暗色卡片 + mono 數字 + 主色（傳入），尺寸/字級對齊現有風格。
 */
export type Series = { date: string; value: number | null }[];

type Point = { date: string; value: number };

function compact(series: Series): Point[] {
  return series
    .filter((p): p is Point => p.value != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function fmtVal(v: number, unit: string): string {
  const digits = unit === '%' || unit === 'kg' ? 1 : v >= 100 ? 0 : 1;
  return v.toFixed(digits);
}

function deltaArrow(d: number): string {
  if (Math.abs(d) < 0.05) return '·';
  return d > 0 ? '↑' : '↓';
}

// ─────────────────────────────────────────────────────────────────
// 方案 A：Hero 數值 + 迷你 sparkline + 7 天變化標籤
// ─────────────────────────────────────────────────────────────────
export function HeroSparklineCard({
  label, series, unit, color,
}: {
  label: string;
  series: Series;
  unit: string;
  color: string;
}) {
  const points = compact(series);
  if (points.length === 0) {
    return <EmptyCard label={label} />;
  }

  const latest = points[points.length - 1]!;
  // 找 7 天前最接近的點計算 delta
  const sevenDaysAgo = DateTime.fromISO(latest.date).minus({ days: 7 }).toMillis();
  const past = [...points].reverse().find((p) => DateTime.fromISO(p.date).toMillis() <= sevenDaysAgo);
  const delta = past ? latest.value - past.value : 0;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  // sparkline 尺寸
  const sw = 90, sh = 32, pad = 2;
  const range = max - min || 1;
  const xs = (i: number) => points.length === 1 ? sw / 2 : pad + (i / (points.length - 1)) * (sw - 2 * pad);
  const ys = (v: number) => pad + (sh - 2 * pad) - ((v - min) / range) * (sh - 2 * pad);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(' ');

  return (
    <div className="bg-surface border border-hairline rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">{label}</p>
        <p className="text-[10px] font-mono tabular" style={{ color: past ? color : 'var(--color-text-3)' }}>
          {past ? `${deltaArrow(delta)} ${Math.abs(delta).toFixed(1)}${unit} · 7d` : '資料不足 7d'}
        </p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-mono font-medium tabular leading-none" style={{ color }}>
            {fmtVal(latest.value, unit)}
          </span>
          {unit && <span className="text-[12px] text-text-3 font-mono mb-0.5">{unit}</span>}
        </div>
        <svg width={sw} height={sh} className="flex-shrink-0">
          <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={xs(points.length - 1)} cy={ys(latest.value)} r="1.8" fill={color} />
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-text-3 font-mono tabular mt-3">
        <span>min {fmtVal(min, unit)}</span>
        <span>avg {fmtVal(avg, unit)}</span>
        <span>max {fmtVal(max, unit)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 方案 B：EMA 平滑趨勢線 + 原始點 + 上升/下降漸層 area
// ─────────────────────────────────────────────────────────────────
export function SmoothedTrendCard({
  label, series, unit, color,
}: {
  label: string;
  series: Series;
  unit: string;
  color: string;
}) {
  const points = compact(series);
  if (points.length === 0) return <EmptyCard label={label} />;

  // EMA 平滑
  const alpha = 0.3;
  const ema: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0) ema.push(points[i]!.value);
    else ema.push(alpha * points[i]!.value + (1 - alpha) * ema[i - 1]!);
  }

  // 整體方向（首 → 末 EMA）
  const overallTrend = ema[ema.length - 1]! - ema[0]!;
  const fillColor = overallTrend > 0 ? '#ff7a45' : '#4ade80';  // 上升橙紅、下降綠

  // SVG 維度
  const W = 320, H = 110, padT = 14, padB = 18, padL = 6, padR = 6;
  const innerH = H - padT - padB;
  const all = [...points.map((p) => p.value), ...ema];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = (max - min) || 1;
  const pad = range * 0.12;
  const yMin = min - pad, yMax = max + pad;
  const yRange = yMax - yMin;
  const xs = (i: number) => points.length === 1 ? W / 2 : padL + (i / (points.length - 1)) * (W - padL - padR);
  const ys = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;

  const emaPath = ema.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  const areaPath = `${emaPath} L${xs(ema.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${xs(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const gradId = `grad-${label.replace(/\s+/g, '-')}`;

  const latest = points[points.length - 1]!;
  const first = points[0]!;
  const diff = latest.value - first.value;

  return (
    <div className="bg-surface border border-hairline rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">{label}</p>
        <p className="text-[10px] font-mono tabular" style={{ color: fillColor }}>
          {deltaArrow(diff)} {Math.abs(diff).toFixed(1)}{unit} · 全期
        </p>
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-[22px] font-mono font-medium tabular leading-none" style={{ color }}>
          {fmtVal(latest.value, unit)}
        </span>
        {unit && <span className="text-[11px] text-text-3 font-mono">{unit}</span>}
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        {/* 原始點 — 半透明小點 */}
        {points.map((p, i) => (
          <circle key={`raw-${p.date}-${i}`} cx={xs(i)} cy={ys(p.value)} r="1.3" fill={color} opacity="0.5" />
        ))}
        {/* EMA 平滑線 — 主視覺 */}
        <path d={emaPath} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-text-3 font-mono tabular mt-1">
        <span>起 {fmtVal(first.value, unit)}</span>
        <span>EMA α=0.3</span>
        <span>今 {fmtVal(latest.value, unit)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 方案 C：熱力條帶（每天一格，顏色深淺 = 數值高低）+ 底部 sparkline
// ─────────────────────────────────────────────────────────────────
export function HeatStripCard({
  label, series, unit, color,
}: {
  label: string;
  series: Series;
  unit: string;
  color: string;
}) {
  const points = compact(series);
  if (points.length === 0) return <EmptyCard label={label} />;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const latest = points[points.length - 1]!;

  // 熱力條帶：每筆數據一格，顏色 opacity 從 0.2 (min) 到 1.0 (max)
  const stripeW = 320, stripeH = 28;
  const cellW = stripeW / points.length;

  // sparkline
  const sw = stripeW, sh = 36, pad = 3;
  const xs = (i: number) => points.length === 1 ? sw / 2 : pad + (i / (points.length - 1)) * (sw - 2 * pad);
  const ys = (v: number) => pad + (sh - 2 * pad) - ((v - min) / range) * (sh - 2 * pad);
  const sparkPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(' ');

  return (
    <div className="bg-surface border border-hairline rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">{label}</p>
        <p className="text-[10px] text-text-3 font-mono tabular">{points.length} 筆</p>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-[22px] font-mono font-medium tabular leading-none" style={{ color }}>
          {fmtVal(latest.value, unit)}
        </span>
        {unit && <span className="text-[11px] text-text-3 font-mono">{unit}</span>}
      </div>
      <svg width="100%" height={stripeH} viewBox={`0 0 ${stripeW} ${stripeH}`} preserveAspectRatio="none" className="rounded-md overflow-hidden">
        {points.map((p, i) => {
          const intensity = 0.2 + ((p.value - min) / range) * 0.8;
          return (
            <rect
              key={`cell-${p.date}-${i}`}
              x={i * cellW}
              y={0}
              width={cellW + 0.5}
              height={stripeH}
              fill={color}
              opacity={intensity}
            />
          );
        })}
      </svg>
      <svg width="100%" height={sh} viewBox={`0 0 ${sw} ${sh}`} preserveAspectRatio="none" className="mt-1">
        <path d={sparkPath} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xs(points.length - 1)} cy={ys(latest.value)} r="1.8" fill={color} />
      </svg>
      <div className="flex justify-between text-[10px] text-text-3 font-mono tabular mt-1">
        <span>淺 = {fmtVal(min, unit)}</span>
        <span>深 = {fmtVal(max, unit)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
function EmptyCard({ label }: { label: string }) {
  return (
    <div className="bg-surface border border-hairline rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-2">{label}</p>
      <p className="text-[12px] text-text-3">無資料</p>
    </div>
  );
}
