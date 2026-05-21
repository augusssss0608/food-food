'use client';
import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { DateTime } from 'luxon';

/**
 * SVG 折線圖 + 分頁手勢 + 長按 scrub tooltip。
 *
 * 用戶要求：畫面內最多顯示 10 條，更多資料左右滑切時段。
 * 行為：
 * - data 預期是時間遞增（早 → 晚）的點，最新在末尾
 * - 分頁：每頁 POINTS_PER_PAGE=10 條，pageIdx=0 = 最新一頁，pageIdx 越大越舊
 * - 觸摸 state machine：
 *     pending → 位移 > MOVE_THRESHOLD 後鎖方向
 *     dx > dy → swipe（水平翻頁 / 拖動）
 *     dy >= dx → scroll（讓瀏覽器原生垂直滾動接管）
 *   也支援長按 LONG_PRESS_MS 不動 → 進 scrub（tooltip 跟手）
 *   多手指 reset
 * - Tooltip clamp：hoverPercent < 12 → translateX(0)；> 88 → translateX(-100%)；其餘 -50%
 * - iOS 長按副作用關閉：WebkitTouchCallout / UserSelect: none
 *
 * unmount cleanup 清 long-press timer。
 */
const POINTS_PER_PAGE = 10;
const MOVE_THRESHOLD = 10;
const LONG_PRESS_MS = 400;
const PAGE_SWIPE_THRESHOLD = 60;  // 釋放時 |dx| > 此值 → 翻頁

type Phase = 'idle' | 'pending' | 'scrub' | 'scroll' | 'swipe';

export function LineChart({
  data,
  unit,
  color,
}: {
  data: { date: string; value: number | null }[];
  unit: string;
  color: string;
}) {
  // 跳過 null，保留時間順序
  const allPoints = data
    .map((d) => (d.value == null ? null : { date: d.date, value: d.value }))
    .filter((p): p is { date: string; value: number } => p != null);

  const svgRef = useRef<SVGSVGElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchXRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);  // 相對當前 page 的 idx
  const [pageIdx, setPageIdx] = useState(0);                       // 0 = 最新頁
  const [swipeOffset, setSwipeOffset] = useState(0);               // 拖動中 X 偏移 (px)

  useEffect(() => () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  if (allPoints.length === 0) {
    return <p className="text-text-3 text-[12px] text-center py-6">無資料</p>;
  }

  // 分頁：pageIdx=0 取最後 N 個（最新），pageIdx=1 取倒數第 N+1 到 2N 個（更舊），依此類推
  const totalPages = Math.max(1, Math.ceil(allPoints.length / POINTS_PER_PAGE));
  const safePageIdx = Math.min(pageIdx, totalPages - 1);
  const end = allPoints.length - safePageIdx * POINTS_PER_PAGE;
  const start = Math.max(0, end - POINTS_PER_PAGE);
  const points = allPoints.slice(start, end);

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
    setSwipeOffset(0);
  }

  function onTouchStart(e: TouchEvent<SVGSVGElement>) {
    if (e.touches.length !== 1) { reset(); return; }
    const t = e.touches[0]!;
    phaseRef.current = 'pending';
    startRef.current = { x: t.clientX, y: t.clientY };
    lastTouchXRef.current = t.clientX;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      // 長按不動 → 進 scrub
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
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        clearLongPress();
        if (Math.abs(dx) > Math.abs(dy)) {
          phaseRef.current = 'swipe';
          setSwipeOffset(dx);
        } else {
          phaseRef.current = 'scroll';
        }
      }
      return;
    }
    if (phaseRef.current === 'swipe') {
      setSwipeOffset(dx);
      return;
    }
    if (phaseRef.current === 'scrub') {
      setHoverIdx(clientXToIdx(t.clientX));
    }
    // scroll：什麼都不做
  }

  function onTouchEnd() {
    const phase = phaseRef.current;
    if (phase === 'swipe') {
      // 右滑（dx > 0）→ 看更舊（pageIdx++，因為 pageIdx 大表示更舊）
      // 左滑（dx < 0）→ 看更新（pageIdx--）
      if (swipeOffset > PAGE_SWIPE_THRESHOLD && safePageIdx < totalPages - 1) {
        setPageIdx(safePageIdx + 1);
      } else if (swipeOffset < -PAGE_SWIPE_THRESHOLD && safePageIdx > 0) {
        setPageIdx(safePageIdx - 1);
      }
    }
    reset();
  }
  function onTouchCancel() { reset(); }

  const hovered = hoverIdx != null ? points[hoverIdx]! : null;
  const hoverPercent = hoverIdx != null ? (xPos(hoverIdx) / W) * 100 : null;

  let tooltipTransform = 'translateX(-50%)';
  if (hoverPercent != null) {
    if (hoverPercent < 12) tooltipTransform = 'translateX(0)';
    else if (hoverPercent > 88) tooltipTransform = 'translateX(-100%)';
  }

  // 拖動翻頁時 SVG 跟手位移；長按 scrub 不位移
  const swiping = phaseRef.current === 'swipe';
  const svgTransform = swiping ? `translateX(${swipeOffset}px)` : 'translateX(0)';
  const svgTransition = swiping ? 'none' : 'transform 200ms ease-out';

  // 分頁提示：第 N / 共 M 頁（M=1 時不顯示）
  const showPager = totalPages > 1;

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

      <div style={{ overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="block select-none"
          style={{
            touchAction: 'pan-y',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            transform: svgTransform,
            transition: svgTransition,
          }}
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
      </div>

      <div className="flex justify-between text-[10px] text-text-2 font-mono tabular mt-1">
        <span>min {minY.toFixed(1)}{unit}</span>
        {/* 只在最新頁顯示「最新 X」；舊頁顯示「末筆 X」避免語義誤導（不是 90 天最新） */}
        <span className="text-text font-medium">
          {safePageIdx === 0 ? '最新' : '末筆'} {last.value.toFixed(1)}{unit}
        </span>
        <span>max {maxY.toFixed(1)}{unit}</span>
      </div>

      {showPager && (
        <div className="flex justify-center items-center gap-2 mt-1.5">
          {/* 點按式翻頁，輔助手勢失效時的 fallback */}
          <button
            type="button"
            onClick={() => safePageIdx < totalPages - 1 && setPageIdx(safePageIdx + 1)}
            disabled={safePageIdx >= totalPages - 1}
            aria-label="更舊"
            className="text-text-3 disabled:opacity-30 active:scale-90 transition-all px-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="text-[10px] text-text-3 font-mono tabular">
            {safePageIdx + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => safePageIdx > 0 && setPageIdx(safePageIdx - 1)}
            disabled={safePageIdx <= 0}
            aria-label="更新"
            className="text-text-3 disabled:opacity-30 active:scale-90 transition-all px-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = DateTime.fromISO(iso);
  if (!d.isValid) return iso.slice(0, 10);
  return d.toFormat('M/d');
}
