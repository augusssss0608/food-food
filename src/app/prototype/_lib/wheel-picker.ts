'use client';
import { useRef, useState } from 'react';

/**
 * 通用垂直 picker spinner state + 手势 hook。
 * 视觉由调用方自己渲染。
 *
 * - 首尾循环（cycle）
 * - 拇指上下拖动 → 实时 offset
 * - 松手 → snap 到最近 + 惯性余滑
 *
 * 返回：
 * - idx: 当前选中索引（已 wrap 在 [0, count-1]）
 * - dragOffset: 拖动中的视觉偏移量（px，>0 向下）
 * - getOffsetIdx(rel): 在当前 idx 上下 rel 行的索引（自动循环）
 * - 4 个 pointer handler 绑给 picker 容器
 */
export function useWheelPicker(itemCount: number, itemHeight: number) {
  const [idx, setIdx] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const lastYRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const velRef = useRef<number>(0);

  const safeIdx = itemCount === 0 ? 0 : ((idx % itemCount) + itemCount) % itemCount;

  function getOffsetIdx(rel: number): number {
    if (itemCount === 0) return 0;
    return ((safeIdx + rel) % itemCount + itemCount) % itemCount;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (itemCount === 0) return;
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    lastTimeRef.current = Date.now();
    velRef.current = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;
    setDragOffset(dy);
    if (lastYRef.current != null && lastTimeRef.current != null) {
      const dt = Date.now() - lastTimeRef.current;
      if (dt > 0) velRef.current = (e.clientY - lastYRef.current) / dt;
    }
    lastYRef.current = e.clientY;
    lastTimeRef.current = Date.now();
  }
  function commitDrag() {
    if (startYRef.current == null) return;
    const dy = dragOffset;
    const vel = velRef.current; // px/ms
    // 拖动距离换算 step
    let stepShift = -Math.round(dy / itemHeight);
    // 速度惯性
    if (Math.abs(vel) > 0.4) {
      stepShift += -Math.round(vel * 6);
    }
    if (itemCount > 0 && stepShift !== 0) {
      setIdx((i) => ((i + stepShift) % itemCount + itemCount) % itemCount);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(Math.min(20, Math.abs(stepShift) * 4));
      }
    }
    setDragOffset(0);
    startYRef.current = null;
    lastYRef.current = null;
    lastTimeRef.current = null;
    velRef.current = 0;
  }
  function onPointerUp(_e?: React.PointerEvent) { commitDrag(); }
  function onPointerCancel(_e?: React.PointerEvent) {
    setDragOffset(0);
    startYRef.current = null;
    lastYRef.current = null;
    lastTimeRef.current = null;
    velRef.current = 0;
  }

  function step(dir: -1 | 1) {
    if (itemCount === 0) return;
    setIdx((i) => ((i + dir) % itemCount + itemCount) % itemCount);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
  }

  return {
    idx: safeIdx,
    setIdx,
    dragOffset,
    getOffsetIdx,
    step,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    isDragging: startYRef.current != null,
  };
}
