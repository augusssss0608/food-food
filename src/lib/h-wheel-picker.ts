'use client';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * 橫向 wheel picker hook（RAF release animation + per-tick haptic + 可選 cyclic）。
 * 用於 record-meal-sheet 的 mode strip + preset cover-flow。
 */
export interface UseHWheelPickerOptions {
  /** 默認 true：list 大、首尾循環；小 list（mode）傳 false 走線性 + rubber-band */
  cyclic?: boolean;
  /** 單次 release 最多切幾格，默認 8；小 list 可設 1 */
  maxStep?: number;
  /** 跨整數刻度（半格 detent crossing）時觸發，給 caller 加視覺反饋 */
  onTick?: () => void;
}

export function useHWheelPicker(itemCount: number, itemWidth: number, options: UseHWheelPickerOptions = {}) {
  const { cyclic = true, maxStep = 8, onTick } = options;
  const [idx, setIdxState] = useState(0);
  const [dragOffset, setDragOffsetState] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const dragOffsetRef = useRef(0);
  const setDragOffset = (v: number) => {
    dragOffsetRef.current = v;
    setDragOffsetState(v);
  };

  const idxRef = useRef(0);
  const startXRef = useRef<number | null>(null);
  const startOffsetRef = useRef(0);
  const lastXRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);
  const velRef = useRef<number>(0);
  const tickRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastHapticRef = useRef<number>(0);

  function clampIdx(i: number): number {
    if (itemCount === 0) return 0;
    if (cyclic) return ((i % itemCount) + itemCount) % itemCount;
    return Math.max(0, Math.min(itemCount - 1, i));
  }
  const safeIdx = clampIdx(idx);

  function setIdx(updater: number | ((i: number) => number)) {
    setIdxState((prev) => {
      const next = typeof updater === 'function' ? (updater as (i: number) => number)(prev) : updater;
      const clamped = clampIdx(next);
      idxRef.current = clamped;
      return clamped;
    });
  }

  function getOffsetIdx(rel: number): number | null {
    if (itemCount === 0) return null;
    if (cyclic) return ((safeIdx + rel) % itemCount + itemCount) % itemCount;
    const t = safeIdx + rel;
    if (t < 0 || t >= itemCount) return null;
    return t;
  }

  function fireTick(strength: number, throttleMs = 0) {
    if (throttleMs > 0) {
      const now = performance.now();
      if (now - lastHapticRef.current < throttleMs) return;
      lastHapticRef.current = now;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(strength); } catch {}
    }
  }

  function cancelRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  useEffect(() => () => cancelRaf(), []);

  function animateTo(fromOffset: number, duration: number) {
    setIsAnimating(true);
    const startTime = performance.now();
    let lastFrameTick = Math.round(fromOffset / itemWidth);
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = fromOffset * (1 - eased);
      const frameTick = Math.round(cur / itemWidth);
      if (frameTick !== lastFrameTick) {
        lastFrameTick = frameTick;
        fireTick(2, 60);
      }
      if (t < 1) {
        setDragOffset(cur);
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDragOffset(0);
        setIsAnimating(false);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (itemCount === 0) return;
    cancelRaf();
    setIsAnimating(false);
    const currentOffset = dragOffsetRef.current;
    startOffsetRef.current = currentOffset;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTRef.current = Date.now();
    velRef.current = 0;
    tickRef.current = Math.round(currentOffset / itemWidth);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (startXRef.current == null) return;
    let dx = e.clientX - startXRef.current + startOffsetRef.current;
    if (!cyclic && itemCount > 0) {
      const maxRight = safeIdx * itemWidth;
      const maxLeft = -(itemCount - 1 - safeIdx) * itemWidth;
      if (dx > maxRight) dx = maxRight + (dx - maxRight) * 0.25;
      else if (dx < maxLeft) dx = maxLeft + (dx - maxLeft) * 0.25;
    }
    setDragOffset(dx);
    const newTick = Math.round(dx / itemWidth);
    if (newTick !== tickRef.current) {
      tickRef.current = newTick;
      fireTick(3);
      onTick?.();
    }
    if (lastXRef.current != null && lastTRef.current != null) {
      const dt = Date.now() - lastTRef.current;
      if (dt > 0) velRef.current = (e.clientX - lastXRef.current) / dt;
    }
    lastXRef.current = e.clientX;
    lastTRef.current = Date.now();
  }

  function onPointerUp(_e?: ReactPointerEvent) {
    if (startXRef.current == null) return;
    const dx = dragOffsetRef.current;
    const vel = velRef.current;

    let stepShift = -Math.round(dx / itemWidth);
    if (Math.abs(vel) > 0.25) {
      const inertiaSteps = -Math.round(vel * 6);
      const maxInertia = Math.max(1, itemCount - 1);
      stepShift += Math.max(-maxInertia, Math.min(maxInertia, inertiaSteps));
    }
    if (!cyclic) {
      const finalIdx = safeIdx + stepShift;
      if (finalIdx < 0) stepShift = -safeIdx;
      else if (finalIdx > itemCount - 1) stepShift = itemCount - 1 - safeIdx;
    }
    const hardCap = Math.max(1, Math.min(8, maxStep));
    stepShift = Math.max(-hardCap, Math.min(hardCap, stepShift));
    if (cyclic && itemCount > 0 && stepShift !== 0 && stepShift % itemCount === 0) {
      stepShift = stepShift > 0 ? stepShift - 1 : stepShift + 1;
    }

    startXRef.current = null;
    lastXRef.current = null;
    lastTRef.current = null;
    velRef.current = 0;

    if (itemCount > 0 && stepShift !== 0) {
      setIdxState((i) => {
        const clamped = clampIdx(i + stepShift);
        idxRef.current = clamped;
        return clamped;
      });
      const visualFrom = dx + stepShift * itemWidth;
      setDragOffset(visualFrom);
      animateTo(visualFrom, 280);
    } else {
      animateTo(dx, 200);
    }
  }

  function onPointerCancel(_e?: ReactPointerEvent) {
    cancelRaf();
    setDragOffset(0);
    setIsAnimating(false);
    startXRef.current = null;
    lastXRef.current = null;
    lastTRef.current = null;
    velRef.current = 0;
  }

  function snapTo(targetIdx: number, opts: { animate?: boolean; haptic?: boolean } = {}) {
    const { animate = false, haptic = true } = opts;
    if (itemCount === 0) return;
    const clamped = clampIdx(targetIdx);
    const delta = clamped - idxRef.current;
    if (delta === 0) return;
    cancelRaf();
    idxRef.current = clamped;
    setIdxState(clamped);
    if (animate) {
      const visualFrom = delta * itemWidth + dragOffsetRef.current;
      setDragOffset(visualFrom);
      animateTo(visualFrom, 280);
    } else {
      setDragOffset(0);
    }
    if (haptic && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(6); } catch {}
    }
  }

  return {
    idx: safeIdx,
    setIdx,
    snapTo,
    dragOffset,
    dragOffsetRef,
    isAnimating,
    getOffsetIdx,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
