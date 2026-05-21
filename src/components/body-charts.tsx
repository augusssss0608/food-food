'use client';
import { DateTime } from 'luxon';

/**
 * 三種可看到逐筆歷史數值的可視化變體（D / E / F），並排在 /history/body 給用戶比較。
 *
 * D = 縱向時間軸（GitHub commit 風，每筆一個 timeline node）
 * E = 表格 + 迷你進度條（Airtable 風，數值 + 與上筆 delta + 區間位置）
 * F = 折線圖 + 列表混合（上半趨勢線，下半可滾動列表）
 *
 * 共用輸入：series = [{ date, value }]，value 可為 null（該天沒測）。
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

function fmtDate(iso: string): string {
  const d = DateTime.fromISO(iso);
  if (!d.isValid) return iso.slice(0, 10);
  return d.toFormat('M/d');
}

function fmtDateRelative(iso: string, todayISO?: string): string {
  const d = DateTime.fromISO(iso);
  if (!d.isValid) return iso.slice(0, 10);
  const today = todayISO ? DateTime.fromISO(todayISO) : DateTime.now();
  const days = Math.round(today.startOf('day').diff(d.startOf('day'), 'days').days);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return d.toFormat('M/d');
}

function deltaSign(d: number): { arrow: string; sign: number } {
  if (Math.abs(d) < 0.05) return { arrow: '·', sign: 0 };
  return d > 0 ? { arrow: '↑', sign: 1 } : { arrow: '↓', sign: -1 };
}

// ─────────────────────────────────────────────────────────────────
// 方案 D：縱向時間軸（每筆一個 node + 與上筆 delta）
// ─────────────────────────────────────────────────────────────────
export function TimelineCard({
  label, series, unit, color,
}: {
  label: string;
  series: Series;
  unit: string;
  color: string;
}) {
  // 反序：最新在最上
  const pts = compact(series).slice().reverse();
  if (pts.length === 0) return <EmptyCard label={label} />;

  return (
    <div className="bg-surface border border-hairline rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">{label}</p>
        <p className="text-[10px] text-text-3 font-mono tabular">共 {pts.length} 筆</p>
      </div>
      <ul className="space-y-3">
        {pts.map((p, i) => {
          const prev = pts[i + 1];
          const delta = prev ? p.value - prev.value : 0;
          const { arrow, sign } = deltaSign(delta);
          const deltaColor = sign === 0 ? 'var(--color-text-3)' : sign > 0 ? '#ff7a45' : '#4ade80';
          return (
            <li key={p.date} className="flex gap-3 items-start">
              <div className="flex flex-col items-center pt-1 flex-shrink-0" style={{ width: 12 }}>
                <span
                  className="block rounded-full"
                  style={{
                    width: 8, height: 8, background: color,
                    boxShadow: i === 0 ? `0 0 0 3px ${color}33` : undefined,
                  }}
                />
                {i < pts.length - 1 && (
                  <span className="flex-1 bg-hairline mt-1" style={{ width: 1, minHeight: 24 }} />
                )}
              </div>
              <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3 pb-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-3 font-mono uppercase tracking-wider">
                    {fmtDateRelative(p.date)}
                  </span>
                  <span className="text-[18px] font-mono font-medium tabular leading-tight" style={{ color: i === 0 ? color : 'var(--color-text)' }}>
                    {fmtVal(p.value, unit)}<span className="text-[11px] text-text-3 ml-0.5">{unit}</span>
                  </span>
                </div>
                {prev && (
                  <span className="text-[11px] font-mono tabular" style={{ color: deltaColor }}>
                    {arrow} {Math.abs(delta).toFixed(1)}{unit}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 方案 E：表格 + 迷你進度條（區間位置可視化）
// ─────────────────────────────────────────────────────────────────
export function TableCard({
  label, series, unit, color,
}: {
  label: string;
  series: Series;
  unit: string;
  color: string;
}) {
  const pts = compact(series).slice().reverse();
  if (pts.length === 0) return <EmptyCard label={label} />;

  const values = pts.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <div className="bg-surface border border-hairline rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">{label}</p>
        <p className="text-[10px] text-text-3 font-mono tabular">
          {fmtVal(min, unit)} ~ {fmtVal(max, unit)}
        </p>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: '52px 1fr auto 76px' }}>
        {pts.map((p, i) => {
          const prev = pts[i + 1];
          const delta = prev ? p.value - prev.value : 0;
          const { arrow, sign } = deltaSign(delta);
          const deltaColor = sign === 0 ? 'var(--color-text-3)' : sign > 0 ? '#ff7a45' : '#4ade80';
          const pct = ((p.value - min) / range) * 100;
          const isLatest = i === 0;
          return (
            <div key={p.date} className="contents">
              <span className="text-[11px] text-text-3 font-mono tabular self-center">
                {fmtDate(p.date)}
              </span>
              <span
                className="text-[13px] font-mono font-medium tabular self-center"
                style={{ color: isLatest ? color : 'var(--color-text)' }}
              >
                {fmtVal(p.value, unit)}<span className="text-[10px] text-text-3 ml-0.5">{unit}</span>
              </span>
              <span className="text-[10px] font-mono tabular self-center text-right" style={{ color: deltaColor }}>
                {prev ? `${arrow} ${Math.abs(delta).toFixed(1)}` : '—'}
              </span>
              <span className="self-center relative" style={{ height: 6 }}>
                <span className="absolute inset-0 rounded-full bg-hairline" />
                <span
                  className="absolute top-0 bottom-0 left-0 rounded-full"
                  style={{ width: `${Math.max(pct, 2)}%`, background: color, opacity: isLatest ? 1 : 0.55 }}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 方案 F：折線圖（上）+ 列表（下）混合
// ─────────────────────────────────────────────────────────────────
export function HybridCard({
  label, series, unit, color,
}: {
  label: string;
  series: Series;
  unit: string;
  color: string;
}) {
  const ptsAsc = compact(series);
  if (ptsAsc.length === 0) return <EmptyCard label={label} />;
  const pts = ptsAsc.slice().reverse();
  const latest = ptsAsc[ptsAsc.length - 1]!;

  // 上半：簡潔折線（無逐點標註，純趨勢）
  const W = 320, H = 90, padT = 10, padB = 14, padL = 6, padR = 6;
  const innerH = H - padT - padB;
  const values = ptsAsc.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = range * 0.12;
  const yMin = min - pad, yMax = max + pad;
  const yRange = yMax - yMin;
  const xs = (i: number) => ptsAsc.length === 1 ? W / 2 : padL + (i / (ptsAsc.length - 1)) * (W - padL - padR);
  const ys = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;
  const path = ptsAsc.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(' ');
  const areaPath = `${path} L${xs(ptsAsc.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${xs(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const gradId = `hybrid-grad-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="bg-surface border border-hairline rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">{label}</p>
        <span className="text-[20px] font-mono font-medium tabular" style={{ color }}>
          {fmtVal(latest.value, unit)}<span className="text-[11px] text-text-3 ml-0.5">{unit}</span>
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block mb-3">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xs(ptsAsc.length - 1)} cy={ys(latest.value)} r="2.5" fill={color} />
      </svg>
      <div className="border-t border-hairline pt-2">
        <div className="grid gap-y-1.5 text-[12px] font-mono tabular" style={{ gridTemplateColumns: '56px 1fr auto' }}>
          {pts.map((p, i) => {
            const prev = pts[i + 1];
            const delta = prev ? p.value - prev.value : 0;
            const { arrow, sign } = deltaSign(delta);
            const deltaColor = sign === 0 ? 'var(--color-text-3)' : sign > 0 ? '#ff7a45' : '#4ade80';
            const isLatest = i === 0;
            return (
              <div key={p.date} className="contents">
                <span className="text-[11px] text-text-3 self-center">{fmtDate(p.date)}</span>
                <span
                  className="self-center"
                  style={{ color: isLatest ? color : 'var(--color-text)', fontWeight: isLatest ? 600 : 400 }}
                >
                  {fmtVal(p.value, unit)}<span className="text-[10px] text-text-3 ml-0.5">{unit}</span>
                </span>
                <span className="self-center text-right text-[11px]" style={{ color: deltaColor }}>
                  {prev ? `${arrow} ${Math.abs(delta).toFixed(1)}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
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
