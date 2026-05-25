'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { useHWheelPicker, MODES, presetListForMode } from '../_lib/picker-shared';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot } from '@/lib/home-snapshot';

const MODE_W = 116;
const CARD_W = 200;
const CARD_INNER_W = CARD_W - 16;
const CARD_INNER_H = 118;
const PRESET_AXIS_LOCK = 8;
const VERTICAL_TRIGGER = 60;
const CLOSE_DRAG_TRIGGER = 90;
const DOT_PIXEL = 22;
const LONG_PRESS_MS = 800;

type SheetView = 'list' | 'create' | 'edit';

export function TwinHContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SheetView>('list');
  const [delOpen, setDelOpen] = useState(false);

  const modeWheel = useHWheelPicker(MODES.length, MODE_W, { cyclic: true, maxStep: 1 });
  const currentMode = MODES[modeWheel.idx]!.key;

  const [tickPulse, setTickPulse] = useState(0);
  const presetList = useMemo(() => presetListForMode(api.presets, currentMode), [api.presets, currentMode]);
  const presetWheel = useHWheelPicker(presetList.length, CARD_W, {
    maxStep: 1,
    onTick: () => setTickPulse((t) => t + 1),
  });
  const currentPreset = presetList[presetWheel.idx];

  // —— preset 手势：水平 1-step wheel / 垂直 CRUD / 长按 record ——
  const gestureAxis = useRef<'idle' | 'horizontal' | 'vertical'>('idle');
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const [verticalDrag, setVerticalDrag] = useState(0);
  const [pressing, setPressing] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);

  function startLongPress() {
    if (currentMode === 'camera' || !currentPreset || api.recordingId != null) return;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    setPressing(true);
    longPressTimerRef.current = window.setTimeout(async () => {
      longPressTimerRef.current = null;
      setPressing(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([6, 30, 18]); } catch {}
      }
      if (currentPreset) {
        const ok = await api.recordCustomPreset(currentPreset);
        if (ok) setOpen(false);
      }
    }, LONG_PRESS_MS);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (pressing) setPressing(false);
  }

  function onPresetPointerDown(e: React.PointerEvent) {
    gestureAxis.current = 'idle';
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    setVerticalDrag(0);
    presetWheel.pointerHandlers.onPointerDown(e);
    startLongPress();
  }
  function onPresetPointerMove(e: React.PointerEvent) {
    if (startXRef.current == null || startYRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (gestureAxis.current === 'idle') {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > PRESET_AXIS_LOCK || absDy > PRESET_AXIS_LOCK) {
        gestureAxis.current = absDx > absDy ? 'horizontal' : 'vertical';
        cancelLongPress();
        if (gestureAxis.current === 'vertical') {
          presetWheel.pointerHandlers.onPointerCancel(e);
        }
      }
    }
    if (gestureAxis.current === 'horizontal') {
      presetWheel.pointerHandlers.onPointerMove(e);
    } else if (gestureAxis.current === 'vertical') {
      setVerticalDrag(dy);
    }
  }
  function onPresetPointerUp(e: React.PointerEvent) {
    cancelLongPress();
    const dy = startYRef.current != null ? e.clientY - startYRef.current : 0;
    if (gestureAxis.current === 'vertical' && currentPreset && currentMode !== 'camera') {
      if (dy < -VERTICAL_TRIGGER) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        setDelOpen(true);
      } else if (dy > VERTICAL_TRIGGER) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        api.clearDuplicate();
        setView('edit');
      }
    } else if (gestureAxis.current === 'horizontal') {
      presetWheel.pointerHandlers.onPointerUp(e);
    } else {
      presetWheel.pointerHandlers.onPointerCancel(e);
    }
    gestureAxis.current = 'idle';
    startXRef.current = null;
    startYRef.current = null;
    setVerticalDrag(0);
  }
  function onPresetPointerCancel(e: React.PointerEvent) {
    cancelLongPress();
    presetWheel.pointerHandlers.onPointerCancel(e);
    gestureAxis.current = 'idle';
    startXRef.current = null;
    startYRef.current = null;
    setVerticalDrag(0);
  }

  // —— page dots scrub（不限步，跨 22px 切一个 idx，vibrate 节流 50ms） ——
  const dotsStartX = useRef<number | null>(null);
  const dotsStartIdx = useRef<number>(0);
  const dotsLastIdx = useRef<number>(0);
  const dotsLastVibrate = useRef<number>(0);
  function onDotsPointerDown(e: React.PointerEvent) {
    dotsStartX.current = e.clientX;
    dotsStartIdx.current = presetWheel.idx;
    dotsLastIdx.current = presetWheel.idx;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onDotsPointerMove(e: React.PointerEvent) {
    if (dotsStartX.current == null) return;
    const dx = e.clientX - dotsStartX.current;
    const delta = Math.round(dx / DOT_PIXEL);
    // cyclic：超出列表頭尾繞回去
    const len = presetList.length;
    if (len === 0) return;
    const raw = dotsStartIdx.current + delta;
    const newIdx = ((raw % len) + len) % len;
    if (newIdx !== dotsLastIdx.current) {
      presetWheel.snapTo(newIdx, { animate: false, haptic: false });
      dotsLastIdx.current = newIdx;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        const now = performance.now();
        if (now - dotsLastVibrate.current > 50) {
          try { navigator.vibrate(2); } catch {}
          dotsLastVibrate.current = now;
        }
      }
    }
  }
  function onDotsPointerUp() {
    dotsStartX.current = null;
  }

  // —— sheet 下滑关闭（仿主页 add-meal-sheet：sheet 始终 mount，靠 transform + CSS transition） ——
  const closeStartY = useRef<number | null>(null);
  const closeDragMoved = useRef(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  function startCloseDrag(clientY: number) {
    if (!open) return;
    closeStartY.current = clientY;
    closeDragMoved.current = false;
    setDragging(true);
  }
  function updateCloseDrag(clientY: number) {
    if (closeStartY.current == null) return;
    const dy = clientY - closeStartY.current;
    if (Math.abs(dy) > 4) closeDragMoved.current = true;
    setDragY(Math.max(0, dy));
  }
  function endCloseDrag(clientY: number) {
    if (closeStartY.current == null) return;
    const dy = clientY - closeStartY.current;
    closeStartY.current = null;
    setDragging(false);
    if (dy > CLOSE_DRAG_TRIGGER) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      setOpen(false); // transform → translateY(100%) 通过 CSS transition 平滑滑出
    } else {
      setDragY(0);
    }
  }
  function cancelCloseDrag() {
    closeStartY.current = null;
    closeDragMoved.current = false;
    setDragging(false);
    setDragY(0);
  }
  function onCloseDragDown(e: React.PointerEvent) { startCloseDrag(e.clientY); }
  function onCloseDragMove(e: React.PointerEvent) { updateCloseDrag(e.clientY); }
  function onCloseDragUp(e: React.PointerEvent) { endCloseDrag(e.clientY); }

  // open=false 后等关闭动画完成（320ms）再重置 view + dragY，避免下次打开瞬间从 dy 回弹
  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        setView('list');
        setDragY(0);
      }, 320);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
  }, []);

  // —— mode 手势：水平 wheel / 垂直向下 close drag ——
  const modeGestureAxis = useRef<'idle' | 'horizontal' | 'vertical'>('idle');
  const modeStartXRef = useRef<number | null>(null);
  const modeStartYRef = useRef<number | null>(null);

  function onModePointerDown(e: React.PointerEvent) {
    modeGestureAxis.current = 'idle';
    modeStartXRef.current = e.clientX;
    modeStartYRef.current = e.clientY;
    modeWheel.pointerHandlers.onPointerDown(e);
  }
  function onModePointerMove(e: React.PointerEvent) {
    if (modeStartXRef.current == null || modeStartYRef.current == null) return;
    const dx = e.clientX - modeStartXRef.current;
    const dy = e.clientY - modeStartYRef.current;
    if (modeGestureAxis.current === 'idle') {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > PRESET_AXIS_LOCK || absDy > PRESET_AXIS_LOCK) {
        if (absDx > absDy) {
          modeGestureAxis.current = 'horizontal';
        } else if (dy > 0) {
          modeGestureAxis.current = 'vertical';
          modeWheel.pointerHandlers.onPointerCancel(e);
          startCloseDrag(modeStartYRef.current);
        } else {
          modeGestureAxis.current = 'horizontal';
        }
      }
    }
    if (modeGestureAxis.current === 'horizontal') {
      modeWheel.pointerHandlers.onPointerMove(e);
    } else if (modeGestureAxis.current === 'vertical') {
      updateCloseDrag(e.clientY);
    }
  }
  function onModePointerUp(e: React.PointerEvent) {
    if (modeGestureAxis.current === 'vertical') {
      endCloseDrag(e.clientY);
    } else if (modeGestureAxis.current === 'horizontal') {
      modeWheel.pointerHandlers.onPointerUp(e);
    } else {
      modeWheel.pointerHandlers.onPointerCancel(e);
    }
    modeGestureAxis.current = 'idle';
    modeStartXRef.current = null;
    modeStartYRef.current = null;
  }
  function onModePointerCancel(e: React.PointerEvent) {
    modeWheel.pointerHandlers.onPointerCancel(e);
    cancelCloseDrag();
    modeGestureAxis.current = 'idle';
    modeStartXRef.current = null;
    modeStartYRef.current = null;
  }

  // page indicator dots
  const total = presetList.length;
  const maxDots = 7;
  const dotsToShow = Math.min(total, maxDots);
  const activeDot = total <= maxDots
    ? presetWheel.idx
    : Math.round((presetWheel.idx * (maxDots - 1)) / Math.max(1, total - 1));

  const vDragAbs = Math.abs(verticalDrag);
  const showDeleteHint = verticalDrag < -PRESET_AXIS_LOCK;
  const showEditHint = verticalDrag > PRESET_AXIS_LOCK;
  const verticalIntensity = Math.min(1, vDragAbs / VERTICAL_TRIGGER);

  return (
    <PrototypeShell title="Twin Horizontal">
      <RealHomeShell api={api} rightAction={null} />

      <button type="button" onClick={() => setOpen(true)} aria-label="open twin h" className="z-[70]"
        style={{ position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <span className="twh-knob">
          <span className="twh-knob-rule" aria-hidden />
          <span className="twh-knob-dot" aria-hidden />
        </span>
      </button>

      {/* sheet 始终 mount，靠 transform+transition 控制；open=false 时 translateY(100%) 移出屏幕 */}
      <div className="fixed inset-0 z-[80]" style={{ pointerEvents: open ? 'auto' : 'none' }}>
        <div className="absolute inset-0 bg-ink/85 backdrop-blur-md"
          onClick={() => setOpen(false)}
          style={{
            opacity: open ? 1 : 0,
            pointerEvents: open ? 'auto' : 'none',
            transition: 'opacity 200ms ease-out',
          }}
        />
        <div className="absolute left-0 right-0 bottom-0 twh-sheet"
          style={{
            height: 'clamp(340px, 42dvh, 400px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
            transition: dragging ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
            <div className="twh-glow" aria-hidden />

            {/* header */}
            <div className="twh-header flex-shrink-0"
              onPointerDown={onCloseDragDown}
              onPointerMove={onCloseDragMove}
              onPointerUp={onCloseDragUp}
              onPointerCancel={cancelCloseDrag}
              style={{ touchAction: 'none' }}
            >
              <div className="twh-header-left">
                <p className="twh-title">
                  {view === 'list' ? 'ADD MEAL' : view === 'create' ? 'NEW PRESET' : 'EDIT PRESET'}
                </p>
              </div>
              {view === 'list' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (closeDragMoved.current) return;
                    api.clearDuplicate();
                    setView('create');
                  }}
                  className="twh-icon-btn"
                  aria-label="new preset"
                >＋</button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    api.clearDuplicate();
                    setView('list');
                  }}
                  className="twh-icon-btn"
                  aria-label="back"
                >←</button>
              )}
            </div>

            {view === 'list' && (
              <>
                {/* mode strip — minimal segmented：字色 + 底部 lime underline 跟隨 */}
                <div className="flex-shrink-0 twh-mode-strip">
                  <div className="twh-mode-mask-l" aria-hidden />
                  <div className="twh-mode-mask-r" aria-hidden />
                  <div className="twh-mode-track"
                    onPointerDown={onModePointerDown}
                    onPointerMove={onModePointerMove}
                    onPointerUp={onModePointerUp}
                    onPointerCancel={onModePointerCancel}
                    style={{ touchAction: 'none' }}
                  >
                    {[-1, 0, 1].map((rel) => {
                      const realIdx = modeWheel.getOffsetIdx(rel);
                      if (realIdx == null) return null;
                      const m = MODES[realIdx];
                      if (!m) return null;
                      const visualPos = rel * MODE_W + modeWheel.dragOffset;
                      const distC = Math.abs(visualPos) / MODE_W;
                      const opacity = Math.max(0.25, Math.min(1, 1 - distC * 0.5));
                      const isCenter = distC < 0.5;
                      return (
                        <button key={m.key}
                          type="button"
                          onClick={() => {
                            if (modeWheel.isAnimating) return;
                            if (Math.abs(modeWheel.dragOffsetRef.current) > 6) return;
                            if (realIdx === modeWheel.idx) return;
                            modeWheel.snapTo(realIdx, { animate: true });
                          }}
                          className={`twh-mode-cell ${isCenter ? 'twh-mode-cell-active' : ''}`}
                          style={{
                            transform: `translate(-50%, -50%) translateX(${visualPos}px)`,
                            opacity,
                          }}
                        >
                          <span className="twh-mode-label">{m.label}</span>
                          <span className="twh-mode-sub">{m.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* 底部跟隨的 lime underline（拖動時微跟手） */}
                  <span className="twh-mode-underline" aria-hidden
                    style={{ transform: `translateX(calc(-50% + ${modeWheel.dragOffset * 0.3}px))` }}
                  />
                </div>

                {/* preset cover-flow */}
                <div className="flex-1 twh-cover-wrap min-h-0 relative">
                  {currentMode === 'camera' ? (
                    <div className="twh-camera">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-text-3 mt-1">camera</p>
                    </div>
                  ) : presetList.length === 0 ? (
                    <div className="twh-empty">
                      <p className="text-[13px] text-text-3 font-mono">no preset</p>
                      <button onClick={() => { api.clearDuplicate(); setView('create'); }} className="twh-empty-cta">＋ new</button>
                    </div>
                  ) : (
                    <>
                      <div className="twh-cover-mask-l" aria-hidden />
                      <div className="twh-cover-mask-r" aria-hidden />

                      <div className={`twh-swipe-hint twh-swipe-hint-top ${showDeleteHint ? 'twh-swipe-hint-on' : ''}`}
                        style={{ opacity: showDeleteHint ? verticalIntensity : 0 }}
                      >
                        <span className="twh-swipe-hint-arrow">↑</span>
                        <span>刪除</span>
                      </div>
                      <div className={`twh-swipe-hint twh-swipe-hint-bottom ${showEditHint ? 'twh-swipe-hint-on' : ''}`}
                        style={{ opacity: showEditHint ? verticalIntensity : 0 }}
                      >
                        <span className="twh-swipe-hint-arrow">↓</span>
                        <span>編輯</span>
                      </div>

                      <div className="twh-cover-track"
                        onPointerDown={onPresetPointerDown}
                        onPointerMove={onPresetPointerMove}
                        onPointerUp={onPresetPointerUp}
                        onPointerCancel={onPresetPointerCancel}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ touchAction: 'none' }}
                      >
                        {[-2, -1, 0, 1, 2].map((rel) => {
                          const realIdx = presetWheel.getOffsetIdx(rel);
                          if (realIdx == null) return null;
                          const p = presetList[realIdx];
                          if (!p) return null;
                          const visualPos = rel * CARD_W + presetWheel.dragOffset;
                          const distC = Math.abs(visualPos) / CARD_W;
                          const scale = Math.max(0.5, 1 - distC * 0.09);
                          const opacity = Math.max(0, Math.min(1, 1 - distC * 0.55));
                          const isCenter = distC < 0.5;
                          // 卡片小幅跟手：0.3x + clamp ±14，配合 cover-track 150 留出的 16px 上下 buffer，不溢出
                          const yOffset = isCenter ? Math.max(-14, Math.min(14, verticalDrag * 0.3)) : 0;
                          return (
                            <div key={`${p.id}-${rel}`}
                              className={`twh-card ${isCenter ? 'twh-card-active' : ''} ${isCenter && pressing ? 'twh-card-pressing' : ''}`}
                              style={{
                                transform: `translate(${visualPos}px, ${yOffset}px) scale(${scale})`,
                                opacity,
                              }}
                            >
                              {isCenter && tickPulse > 0 && (
                                <span key={`tk-${tickPulse}`} className="twh-card-tick" aria-hidden />
                              )}
                              {isCenter && pressing && (
                                <svg className="twh-card-progress" viewBox={`0 0 ${CARD_INNER_W} ${CARD_INNER_H}`} preserveAspectRatio="none" aria-hidden>
                                  <rect
                                    className="twh-progress-rect"
                                    x="1.5" y="1.5"
                                    width={CARD_INNER_W - 3} height={CARD_INNER_H - 3}
                                    rx="14.5" ry="14.5"
                                    fill="none"
                                    stroke="var(--color-accent)"
                                    strokeWidth="3"
                                    vectorEffect="non-scaling-stroke"
                                    pathLength="1"
                                  />
                                </svg>
                              )}
                              <p className="twh-card-name">{p.name}</p>
                              <p className="twh-card-kcal tabular">
                                {Math.round(p.kcal)}<span className="text-[10px] text-text-3 ml-1">kcal</span>
                              </p>
                              {isCenter && (
                                <p className="twh-card-macro tabular">
                                  <span style={{ color: '#c8ff00' }}>P {Math.round(p.protein_g)}</span>
                                  <span className="opacity-50 mx-1.5">·</span>
                                  <span style={{ color: '#f5a623' }}>C {Math.round(p.carb_g)}</span>
                                  <span className="opacity-50 mx-1.5">·</span>
                                  <span style={{ color: '#a486f4' }}>F {Math.round(p.fat_g)}</span>
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* page dots（可滑） */}
                {currentMode !== 'camera' && presetList.length > 0 && (
                  <div className="flex-shrink-0 twh-pager-wrap"
                    onPointerDown={onDotsPointerDown}
                    onPointerMove={onDotsPointerMove}
                    onPointerUp={onDotsPointerUp}
                    onPointerCancel={onDotsPointerUp}
                    style={{ touchAction: 'none' }}
                  >
                    <div className="twh-pager">
                      {Array.from({ length: dotsToShow }).map((_, k) => (
                        <span key={k} className={`twh-pdot ${k === activeDot ? 'twh-pdot-active' : ''}`} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 操作提示（替代 record button） */}
                <div className="flex-shrink-0 px-5 pb-1 pt-0">
                  <p className="twh-action-hint">
                    {api.recordingId
                      ? <span className="text-accent">recording…</span>
                      : currentMode === 'camera'
                      ? '點 ＋ 新增 · 下滑關閉'
                      : currentPreset
                      ? <>長按卡片<span className="text-accent">記錄</span>　·　↑刪除　·　↓編輯</>
                      : '滑動選 preset · 點 ＋ 新增'}
                  </p>
                </div>
              </>
            )}

            {view === 'create' && (
              <div className="flex-1 px-5 pb-5 pt-2 min-h-0 overflow-y-auto">
                <MockPresetForm
                  submitLabel="保存"
                  onSubmit={async (n, k) => {
                    const ok = await api.addPreset(n, k);
                    if (ok) setView('list');
                  }}
                  onCancel={() => { api.clearDuplicate(); setView('list'); }}
                />
                {api.duplicateName && (
                  <p className="text-[11px] text-danger mt-3 text-center">已存在同名 preset，請改名</p>
                )}
              </div>
            )}

            {view === 'edit' && currentPreset && (
              <div className="flex-1 px-5 pb-5 pt-2 min-h-0 overflow-y-auto">
                <MockPresetForm
                  initial={{ name: currentPreset.name, kcal: currentPreset.kcal }}
                  submitLabel="保存"
                  onSubmit={async (n, k) => {
                    const ok = await api.updatePreset(currentPreset.id, n, k);
                    if (ok) setView('list');
                  }}
                  onCancel={() => { api.clearDuplicate(); setView('list'); }}
                />
                {api.duplicateName && (
                  <p className="text-[11px] text-danger mt-3 text-center">已存在同名 preset，請改名</p>
                )}
              </div>
            )}
        </div>
      </div>

      <InlineConfirmDialog
        open={delOpen}
        title="刪除這個 preset？"
        body={currentPreset ? <span>將永久移除「<span className="text-text font-medium">{currentPreset.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setDelOpen(false)}
        onConfirm={async () => { if (currentPreset) await api.deletePreset(currentPreset.id); setDelOpen(false); }}
      />

      <style>{styles}</style>
    </PrototypeShell>
  );
}

const styles = `
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes twh-knob-dot-slide {
  0%, 100% { transform: translate(-50%, -50%) translateX(-6px); }
  50% { transform: translate(-50%, -50%) translateX(6px); }
}
@keyframes twh-glow-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.6; }
}
@keyframes twh-progress-fill {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
@keyframes twh-tick-pulse {
  0% {
    box-shadow: inset 0 0 0 2px rgba(200,255,0,0.85), 0 0 22px rgba(200,255,0,0.55);
    background: rgba(200,255,0,0.07);
  }
  100% {
    box-shadow: inset 0 0 0 0 rgba(200,255,0,0), 0 0 0 rgba(200,255,0,0);
    background: rgba(200,255,0,0);
  }
}

/* ========== 入口按钮 ========== */
.twh-knob {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 50px; height: 50px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(40,40,48,0.95), rgba(18,18,22,0.95));
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 24px -6px rgba(0,0,0,0.7), 0 0 0 4px rgba(200,255,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06);
}
.twh-knob:active { transform: scale(0.92); }
.twh-knob-rule {
  display: block;
  width: 28px; height: 2px;
  border-radius: 999px;
  background-image: repeating-linear-gradient(90deg, var(--color-accent) 0 2px, transparent 2px 6px);
  opacity: 0.7;
}
.twh-knob-dot {
  position: absolute;
  top: 50%; left: 50%;
  width: 6px; height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(200,255,0,0.9);
  animation: twh-knob-dot-slide 2.6s ease-in-out infinite;
}

/* ========== 半弹窗 ========== */
.twh-sheet {
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #12121a 0%, #0a0a10 100%);
  border-top: 1px solid rgba(200,255,0,0.45);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  box-shadow: 0 -16px 48px -12px rgba(0,0,0,0.6);
  overflow: hidden;
  will-change: transform;
}
.twh-glow {
  position: absolute;
  left: 50%; top: -1px;
  transform: translateX(-50%);
  width: 60%; height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  opacity: 0.5;
  pointer-events: none;
  animation: twh-glow-pulse 2.4s ease-in-out infinite;
}

/* ========== header ========== */
.twh-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 8px;
  user-select: none;
  cursor: grab;
}
.twh-header:active { cursor: grabbing; }
.twh-header-left { pointer-events: none; }
.twh-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2em;
  line-height: 1;
  color: var(--color-text);
}
.twh-icon-btn {
  width: 32px; height: 32px;
  background: rgba(28,28,34,0.7);
  border: 1px solid rgba(200,255,0,0.25);
  border-radius: 10px;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.twh-icon-btn:active { transform: scale(0.9); border-color: var(--color-accent); background: rgba(200,255,0,0.1); }

/* ========== mode strip — minimal segmented ========== */
.twh-mode-strip {
  position: relative;
  height: 56px;
  margin: 0 0 4px;
  overflow: hidden;
  user-select: none;
}
.twh-mode-mask-l, .twh-mode-mask-r {
  position: absolute; top: 0; bottom: 0; width: 50px;
  pointer-events: none; z-index: 2;
}
.twh-mode-mask-l { left: 0; background: linear-gradient(90deg, #12121a 0%, transparent 100%); }
.twh-mode-mask-r { right: 0; background: linear-gradient(-90deg, #12121a 0%, transparent 100%); }
.twh-mode-track {
  position: absolute;
  left: 0; right: 0; top: 0; bottom: 8px;
  cursor: grab;
}
.twh-mode-track:active { cursor: grabbing; }
.twh-mode-cell {
  position: absolute;
  left: 50%; top: 50%;
  width: ${MODE_W - 14}px;
  background: transparent;
  border: none;
  color: var(--color-text-3);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 4px;
  padding: 4px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  cursor: pointer;
  will-change: transform, opacity;
  transition: color 0.22s;
}
.twh-mode-label {
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.02em;
}
.twh-mode-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.5;
  line-height: 1;
  transition: opacity 0.22s, letter-spacing 0.22s;
}
.twh-mode-cell-active {
  color: var(--color-accent);
}
.twh-mode-cell-active .twh-mode-label { font-weight: 600; }
.twh-mode-cell-active .twh-mode-sub { opacity: 0.9; letter-spacing: 0.28em; }
.twh-mode-underline {
  position: absolute;
  left: 50%; bottom: 4px;
  width: 28px; height: 2px;
  background: var(--color-accent);
  border-radius: 999px;
  box-shadow: 0 0 8px rgba(200,255,0,0.65);
  pointer-events: none;
  z-index: 3;
  will-change: transform;
}

/* ========== preset cover flow ========== */
.twh-cover-wrap {
  position: relative;
  overflow: hidden; /* 卡片垂直拖動被 cover-wrap 裁，不溢出到 mode/dots */
  display: flex; align-items: center; justify-content: center;
}
.twh-cover-mask-l, .twh-cover-mask-r {
  position: absolute; top: 0; bottom: 0; width: 70px;
  pointer-events: none; z-index: 3;
}
.twh-cover-mask-l { left: 0; background: linear-gradient(90deg, #0e0e15 0%, rgba(14,14,21,0.6) 60%, transparent 100%); }
.twh-cover-mask-r { right: 0; background: linear-gradient(-90deg, #0e0e15 0%, rgba(14,14,21,0.6) 60%, transparent 100%); }
.twh-cover-track {
  position: relative;
  width: ${CARD_W}px;
  height: 150px;
  cursor: grab;
}
.twh-cover-track:active { cursor: grabbing; }
.twh-card {
  position: absolute;
  left: 0; top: 50%;
  width: ${CARD_INNER_W}px;
  height: ${CARD_INNER_H}px;
  margin-top: -${CARD_INNER_H / 2}px;
  background: linear-gradient(180deg, rgba(28,28,36,0.7) 0%, rgba(18,18,24,0.7) 100%);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  padding: 10px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  will-change: transform, opacity;
  backdrop-filter: blur(6px);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.twh-card-name {
  font-size: 16px;
  color: var(--color-text);
  font-weight: 600;
  text-align: center;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.twh-card-kcal {
  font-size: 20px;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  margin-top: 5px;
}
.twh-card-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  margin-top: 6px;
  letter-spacing: 0.04em;
}
.twh-card-active {
  background: linear-gradient(180deg, rgba(36,40,24,0.85) 0%, rgba(20,22,18,0.95) 100%);
  border-color: rgba(200,255,0,0.55);
  box-shadow: 0 14px 32px -12px rgba(0,0,0,0.7), 0 0 28px rgba(200,255,0,0.18), inset 0 1px 0 rgba(200,255,0,0.12);
}
.twh-card-active .twh-card-name { color: var(--color-accent); font-size: 18px; }
.twh-card-active .twh-card-kcal { color: var(--color-accent); font-size: 24px; }
.twh-card-pressing {
  border-color: rgba(200,255,0,0.8);
  transform-origin: center;
}

/* detent 视觉脉冲 */
.twh-card-tick {
  position: absolute; inset: 0;
  border-radius: 16px;
  pointer-events: none;
  animation: twh-tick-pulse 0.18s ease-out forwards;
}

/* SVG 长按进度环 */
.twh-card-progress {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 2;
}
.twh-progress-rect {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: twh-progress-fill ${LONG_PRESS_MS}ms linear forwards;
  filter: drop-shadow(0 0 6px rgba(200,255,0,0.5));
}

/* ========== swipe hint ========== */
.twh-swipe-hint {
  position: absolute;
  left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--color-accent);
  pointer-events: none;
  z-index: 4;
  transition: opacity 0.12s;
}
.twh-swipe-hint-arrow {
  font-size: 18px;
  line-height: 1;
  margin-bottom: 2px;
  text-shadow: 0 0 8px rgba(200,255,0,0.6);
}
.twh-swipe-hint-top { top: 6px; }
.twh-swipe-hint-bottom { bottom: 6px; flex-direction: column-reverse; }
.twh-swipe-hint-bottom .twh-swipe-hint-arrow { margin-top: 2px; margin-bottom: 0; }

/* ========== page dots（可滑动，平時低可見、拖動時加亮） ========== */
.twh-pager-wrap {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center;
  padding: 12px 40px;
  margin: 4px 12px 0;
  user-select: none;
  cursor: grab;
  background: rgba(200,255,0,0.03);
  border: 1px solid rgba(200,255,0,0.1);
  border-radius: 14px;
  transition: background 0.2s, border-color 0.2s, border-style 0s;
}
.twh-pager-wrap:active {
  cursor: grabbing;
  background: rgba(200,255,0,0.1);
  border-color: rgba(200,255,0,0.45);
  border-style: dashed;
}
.twh-pager {
  display: flex; gap: 8px; align-items: center;
  padding: 2px 0;
}
.twh-pdot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.18);
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.twh-pdot-active {
  background: var(--color-accent);
  transform: scale(1.4);
  box-shadow: 0 0 8px rgba(200,255,0,0.7);
}

.twh-action-hint {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--color-text-3);
  padding: 4px 0 0;
  user-select: none;
}

.twh-camera, .twh-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-accent);
  gap: 8px;
}
.twh-empty-cta {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.14em;
  cursor: pointer;
  box-shadow: 0 6px 16px -4px rgba(200,255,0,0.4);
}
`;
