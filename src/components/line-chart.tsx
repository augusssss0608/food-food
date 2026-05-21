'use client';
import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { DateTime } from 'luxon';

/**
 * 簡單 SVG 折線圖。
 * - 跳過 null 值
 * - 自動算 Y 軸範圍（min/max + 15% padding）
 * - 觸摸 state machine（codex round B 收斂）：
 *     pending：剛 touchstart，只記 startX/Y，不顯 tooltip
 *     scrub：橫向位移 > MOVE_THRESHOLD 且 |dx| > |dy| → 鎖定，後續 move 持續更新
 *     scroll：垂直為主 → 本輪不再顯 tooltip，讓瀏覽器原生滾動接管
 *   也支援長按 LONG_PRESS_MS 不動 → 直接進 scrub（用戶想"停在某點看值"）
 *   多手指（touches.length !== 1）任何時候 clear，避免雙指縮放錯亂
 * - Tooltip clamp（codex round B 推薦：分段而非只看首末點）
 *     hoverPercent < 12 → translateX(0)
 *     hoverPercent > 88 → translateX(-100%)
 *     其餘 translateX(-50%)
 */
const MOVE_THRESHOLD = 10;
const LONG_PRESS_MS = 400;

type Phase = 'idle' | 'pending' | 'scrub' | 'scroll';

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

  const svgRef = useRef<SVGSVGElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchXRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // unmount cleanup：route 切換或 chart 重渲染時清掉 long-press timer，
  // 避免 timer 在 unmount 後跑 setHoverIdx（codex round D low finding）
  useEffect(() => () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  if (points.length === 0) {
    return <p className="text-text-3 text-[12px] text-center py-6">無資料</p>;
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

  function clientXToIdx(clientX: number): number | null {
    if (!svgRef.current || points.length === 0) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const xInSvg = ratio * W;
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(xPos(i) - xInSvg);
      if (dist < minDist) { minDist = dist; nearest = i; }
    }
    return nearest;
  }

  function clearLongPress() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function reset() {
    phaseRef.current = 'idle';
    startRef.current = null;
    lastTouchXRef.current = null;
    clearLongPress();
    setHoverIdx(null);
  }

  function onTouchStart(e: TouchEvent<SVGSVGElement>) {
    // 多手指（縮放手勢等）：清狀態，本輪不參與
    if (e.touches.length !== 1) { reset(); return; }
    const t = e.touches[0]!;
    phaseRef.current = 'pending';
    startRef.current = { x: t.clientX, y: t.clientY };
    lastTouchXRef.current = t.clientX;
    // 長按不動 → 自動進 scrub，按"最近一次 touch 的 x"（手指允許 < threshold 漂移）
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'pending' && lastTouchXRef.current != null) {
        phaseRef.current = 'scrub';
        setHoverIdx(clientXToIdx(lastTouchXRef.current));
      }
    }, LONG_PRESS_MS);
  }

  function onTouchMove(e: TouchEvent<SVGSVGElement>) {
    if (e.touches.length !== 1) { reset(); return; }
    const t = e.touches[0]!;
    const start = startRef.current;
    if (!start) return;
    lastTouchXRef.current = t.clientX;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (phaseRef.current === 'pending') {
      // 移動超過閾值 → 鎖方向：橫向多 → scrub；垂直多 → 讓瀏覽器滾頁
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        clearLongPress();
        if (Math.abs(dx) > Math.abs(dy)) {
          phaseRef.current = 'scrub';
          setHoverIdx(clientXToIdx(t.clientX));
        } else {
          phaseRef.current = 'scroll';
          setHoverIdx(null);
        }
      }
      return;
    }
    if (phaseRef.current === 'scrub') {
      setHoverIdx(clientXToIdx(t.clientX));
    }
    // scroll phase：什麼都不做，讓瀏覽器 pan-y 處理頁面滾動
  }

  function onTouchEnd() { reset(); }
  function onTouchCancel() { reset(); }

  const hovered = hoverIdx != null ? points[hoverIdx]! : null;
  const hoverPercent = hoverIdx != null ? (xPos(hoverIdx) / W) * 100 : null;

  // tooltip 邊界分段防剪
  let tooltipTransform = 'translateX(-50%)';
  if (hoverPercent != null) {
    if (hoverPercent < 12) tooltipTransform = 'translateX(0)';
    else if (hoverPercent > 88) tooltipTransform = 'translateX(-100%)';
  }

  return (
    <div className="relative pt-7">
      {hovered && hoverPercent != null && (
        <div
          className="absolute top-0 pointer-events-none z-10"
          style={{
            left: `${hoverPercent}%`,
            transform: tooltipTransform,
          }}
        >
          <div className="bg-surface-3 border border-hairline-strong rounded-md px-2.5 py-1 text-[11px] font-mono tabular shadow-lg whitespace-nowrap">
            <span className="text-text-3">{formatDate(hovered.date)}</span>
            <span className="text-text font-medium ml-2">
              {hovered.value.toFixed(1)}{unit}
            </span>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block"
        style={{ touchAction: 'pan-y' }}
        preserveAspectRatio="none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
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

        {hovered && hoverIdx != null && (
          <>
            <line
              x1={xPos(hoverIdx)}
              y1={PAD_T - 2}
              x2={xPos(hoverIdx)}
              y2={H - PAD_B + 2}
              stroke="rgba(245, 244, 239, 0.35)"
              strokeWidth="0.6"
              strokeDasharray="2 2"
            />
            <circle
              cx={xPos(hoverIdx)}
              cy={yPos(hovered.value)}
              r={4.5}
              fill={color}
              stroke="#f5f4ef"
              strokeWidth="1.2"
            />
          </>
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-text-2 font-mono tabular mt-1">
        <span>min {minY.toFixed(1)}{unit}</span>
        <span className="text-text font-medium">最新 {last.value.toFixed(1)}{unit}</span>
        <span>max {maxY.toFixed(1)}{unit}</span>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = DateTime.fromISO(iso);
  if (!d.isValid) return iso.slice(0, 10);
  return d.toFormat('M/d');
}
