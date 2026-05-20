/**
 * 簡單 SVG 折線圖，純展示無互動。
 * - 跳過 null 值
 * - 自動算 Y 軸範圍（min/max + 15% padding）
 * - 最新點高亮（半徑大一號）
 * - 下方一行：min / 最新 / max
 *
 * 故意保持 server component（沒 'use client'），減少 client bundle。
 */
export function LineChart({
  data,
  unit,
  color,
}: {
  data: { date: string; value: number | null }[];
  unit: string;
  color: string;
}) {
  const points = data
    .map((d) => (d.value == null ? null : { date: d.date, value: d.value }))
    .filter((p): p is { date: string; value: number } => p != null);

  if (points.length === 0) {
    return <p className="text-text-4 text-[12px] text-center py-6">無資料</p>;
  }

  const values = points.map((p) => p.value);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const range = maxY - minY || 1;
  const pad = range * 0.15;
  const yMin = minY - pad;
  const yMax = maxY + pad;

  const W = 320;
  const H = 100;
  const PAD_L = 6, PAD_R = 6, PAD_T = 8, PAD_B = 8;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xPos = (i: number) =>
    PAD_L + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yPos = (v: number) =>
    PAD_T + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(2)},${yPos(p.value).toFixed(2)}`)
    .join(' ');

  const last = points[points.length - 1]!;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block" preserveAspectRatio="none">
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            cx={xPos(i)}
            cy={yPos(p.value)}
            r={i === points.length - 1 ? 3 : 1.6}
            fill={color}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-text-4 font-mono tabular mt-1">
        <span>min {minY.toFixed(1)}{unit}</span>
        <span className="text-text-2">最新 {last.value.toFixed(1)}{unit}</span>
        <span>max {maxY.toFixed(1)}{unit}</span>
      </div>
    </div>
  );
}
