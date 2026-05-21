'use client';
import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from 'react';
import { DateTime } from 'luxon';

/**
 * SVG 折線圖 + 連續橫向滑動 + 長按 scrub tooltip。
 *
 * 用戶需求（取代分頁）：
 * - 視窗內顯示約 10 個點（POINT_PX 寬度控制）
 * - 橫向不間斷滑動瀏覽全部 90 天數據（native scroll）
 * - 長按 400ms 進入 scrub 模式（暫時禁 native scroll），手指跟手移動 tooltip
 *   釋放後恢復 native scroll
 *
 * iOS 細節：
 * - WebKitOverflowScrolling: 'touch' → iOS 慣性 + 邊界回彈
 * - touch-action 動態切換：scrub 時 'none' 完全交給我們，平時 default 讓瀏覽器處理
 * - WebkitTouchCallout / UserSelect: none → 關長按放大鏡 + 文字選取
 * - 隱藏滾動條，視覺乾淨
 * - 初次掛載 / 數據變更 scrollLeft 設到最右（讓最新資料在視窗內）
 */
const POINT_PX = 32;          // 每個資料點水平佔位（10 個點 ≈ 320px viewport）
const H = 100;
const PAD_T = 8, PAD_B = 8;
const PAD_L = 8, PAD_R = 8;   // SVG 左右留白，避免首末點貼邊
const MIN_W = 320;            // 數據少於 10 點時的最小寬度（佔滿一頁）
const MOVE_THRESHOLD = 10;
const LONG_PRESS_MS = 400;

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

  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchClientXRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // 用 scrollVersion 觸發 re-render 讓 tooltip 跟 scroll 移動
  const [, setScrollVersion] = useState(0);

  useEffect(() => () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 初次掛載 / 數據變更：scroll 到最右（最新資料）。用 useLayoutEffect 在 paint 前設，
  // 避免「先看到最左再跳到最右」一幀閃爍（codex round A polish 反饋）。
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [points.length]);

  // hover tooltip 位置依賴 scrollLeft；綁 scroll 事件強制 re-render
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollVersion((v) => v + 1);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [points.length]);

  if (points.length === 0) {
    return <p className="text-text-3 text-[12px] text-center py-6">無資料</p>;
  }

  const totalW = Math.max(MIN_W, PAD_L + PAD_R + points.length * POINT_PX);
  const innerH = H - PAD_T - PAD_B;

  const values = points.map((p) => p.value);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const range = maxY - minY || 1;
  const pad = range * 0.15;
  const yMin = minY - pad;
  const yMax = maxY + pad;

  // 點 X 座標：center of each POINT_PX slot
  const xPos = (i: number) =>
    points.length === 1
      ? totalW / 2
      : PAD_L + POINT_PX / 2 + i * POINT_PX;
  const yPos = (v: number) =>
    PAD_T + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(2)},${yPos(p.value).toFixed(2)}`)
    .join(' ');

  const last = points[points.length - 1]!;

  function clientXToIdx(clientX: number): number | null {
    const el = containerRef.current;
    if (!el || points.length === 0) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const xInContainer = clientX - rect.left;
    const xInSvg = xInContainer + el.scrollLeft;
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

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 1) {
      // 多指：reset
      clearLongPress();
      setScrubbing(false);
      setHoverIdx(null);
      return;
    }
    const t = e.touches[0]!;
    startRef.current = { x: t.clientX, y: t.clientY };
    lastTouchClientXRef.current = t.clientX;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      // 長按超時 → 進 scrub mode（同時 useEffect 換掉 overflow/touchAction）
      if (lastTouchClientXRef.current != null) {
        setScrubbing(true);
        setHoverIdx(clientXToIdx(lastTouchClientXRef.current));
      }
    }, LONG_PRESS_MS);
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 1) {
      // 多指（縮放手勢等）→ 同 touchstart reset 路徑（codex round A：之前直接 return 漏清了）
      clearLongPress();
      setScrubbing(false);
      setHoverIdx(null);
      startRef.current = null;
      return;
    }
    const t = e.touches[0]!;
    const start = startRef.current;
    if (!start) return;
    lastTouchClientXRef.current = t.clientX;

    if (scrubbing) {
      setHoverIdx(clientXToIdx(t.clientX));
      return;
    }
    // 還沒 scrub：若位移超過閾值，取消長按（讓 native scroll 接管）
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
      clearLongPress();
    }
  }

  function onTouchEnd() {
    clearLongPress();
    startRef.current = null;
    if (scrubbing) {
      setScrubbing(false);
      setHoverIdx(null);
    }
  }

  const hovered = hoverIdx != null ? points[hoverIdx]! : null;
  const containerEl = containerRef.current;
  const containerW = containerEl?.clientWidth ?? MIN_W;
  const scrollLeft = containerEl?.scrollLeft ?? 0;
  const hoverXInContainer =
    hoverIdx != null ? xPos(hoverIdx) - scrollLeft : null;
  const hoverPercent =
    hoverXInContainer != null && containerW > 0
      ? (hoverXInContainer / containerW) * 100
      : null;

  // clamp 邊界：tooltip 約 100px、視窗 ~320px，半寬 ≈ 16%。用 15/85 比 12/88 更安全
  let tooltipTransform = 'translateX(-50%)';
  if (hoverPercent != null) {
    if (hoverPercent < 15) tooltipTransform = 'translateX(0)';
    else if (hoverPercent > 85) tooltipTransform = 'translateX(-100%)';
  }

  return (
    <div className="relative pt-7">
      {hovered && hoverXInContainer != null && (
        <div
          className="absolute top-0 pointer-events-none z-10"
          style={{
            left: `${hoverXInContainer}px`,
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

      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="select-none"
        style={{
          overflowX: scrubbing ? 'hidden' : 'auto',
          overflowY: 'hidden',
          // scrub 時 touchAction:none 完全交給我們處理；非 scrub 時不設，讓瀏覽器
          // 默認處理水平/垂直手勢（水平 swipe 滾容器，垂直 swipe 滾頁面）
          touchAction: scrubbing ? 'none' : undefined,
          WebkitOverflowScrolling: 'touch',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          scrollbarWidth: 'none',  // Firefox 兜底（::-webkit-scrollbar 已全局隱藏）
        }}
      >
        <svg
          width={totalW}
          height={H}
          viewBox={`0 0 ${totalW} ${H}`}
          className="block"
          preserveAspectRatio="xMidYMid meet"
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
