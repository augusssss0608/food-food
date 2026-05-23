'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { useHWheelPicker, PresetCrudModals, MODES, presetListForMode } from '../_lib/picker-shared';
import type { HomeSnapshot } from '@/lib/home-snapshot';

const MODE_W = 116;
const CARD_W = 200;
const PRESET_AXIS_LOCK = 8;     // preset 手势主轴判定阈值
const VERTICAL_TRIGGER = 60;    // preset 垂直滑动多少 px 触发 edit/delete
const CLOSE_DRAG_TRIGGER = 90;  // header 向下拖多少 px 关闭 sheet

export function TwinHContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  // —— mode wheel：非循环 + 一次最多 1 格 + click 走 snapTo 动画 ——
  const modeWheel = useHWheelPicker(MODES.length, MODE_W, { cyclic: false, maxStep: 1 });
  const currentMode = MODES[modeWheel.idx]!.key;

  // detent 视觉脉冲：每次 preset 跨刻度时 +1，center card 用作 key 强制重播动画
  const [tickPulse, setTickPulse] = useState(0);
  const presetList = useMemo(() => presetListForMode(api.presets, currentMode), [api.presets, currentMode]);
  const presetWheel = useHWheelPicker(presetList.length, CARD_W, {
    onTick: () => setTickPulse((t) => t + 1),
  });
  const currentPreset = presetList[presetWheel.idx];

  // —— preset 手势：水平 = wheel，垂直 = 上滑删除 / 下滑编辑 ——
  const gestureAxis = useRef<'idle' | 'horizontal' | 'vertical'>('idle');
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const [verticalDrag, setVerticalDrag] = useState(0);

  function onPresetPointerDown(e: React.PointerEvent) {
    gestureAxis.current = 'idle';
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    setVerticalDrag(0);
    presetWheel.pointerHandlers.onPointerDown(e);
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
    const dy = startYRef.current != null ? e.clientY - startYRef.current : 0;
    if (gestureAxis.current === 'vertical' && currentPreset && currentMode !== 'camera') {
      if (dy < -VERTICAL_TRIGGER) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        setDelOpen(true);
      } else if (dy > VERTICAL_TRIGGER) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        api.clearDuplicate();
        setEditOpen(true);
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
    presetWheel.pointerHandlers.onPointerCancel(e);
    gestureAxis.current = 'idle';
    startXRef.current = null;
    startYRef.current = null;
    setVerticalDrag(0);
  }

  // —— sheet header 下拉关闭 ——
  const closeStartY = useRef<number | null>(null);
  const closeDragMoved = useRef(false);
  const [closeDragY, setCloseDragY] = useState(0);
  function startCloseDrag(clientY: number) {
    closeStartY.current = clientY;
    closeDragMoved.current = false;
  }
  function updateCloseDrag(clientY: number) {
    if (closeStartY.current == null) return;
    const dy = clientY - closeStartY.current;
    if (Math.abs(dy) > 4) closeDragMoved.current = true;
    setCloseDragY(dy > 0 ? dy : 0);
  }
  function endCloseDrag(clientY: number) {
    if (closeStartY.current == null) return;
    const dy = clientY - closeStartY.current;
    closeStartY.current = null;
    if (dy > CLOSE_DRAG_TRIGGER) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      setOpen(false);
    }
    setCloseDragY(0);
  }
  function cancelCloseDrag() {
    closeStartY.current = null;
    closeDragMoved.current = false;
    setCloseDragY(0);
  }

  function onCloseDragDown(e: React.PointerEvent) { startCloseDrag(e.clientY); }
  function onCloseDragMove(e: React.PointerEvent) { updateCloseDrag(e.clientY); }
  function onCloseDragUp(e: React.PointerEvent) { endCloseDrag(e.clientY); }

  // —— mode 手势包装：水平给 wheel，垂直给 sheet close drag ——
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
        // 垂直且向下：交给 sheet close drag
        modeGestureAxis.current = absDx > absDy ? 'horizontal' : 'vertical';
        if (modeGestureAxis.current === 'vertical') {
          modeWheel.pointerHandlers.onPointerCancel(e);
          startCloseDrag(modeStartYRef.current);
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

  async function onRec() {
    if (currentMode === 'camera') return;
    if (currentPreset) { const ok = await api.recordCustomPreset(currentPreset); if (ok) setOpen(false); }
  }

  // page indicator dots
  const total = presetList.length;
  const maxDots = 7;
  const dotsToShow = Math.min(total, maxDots);
  const activeDot = total <= maxDots
    ? presetWheel.idx
    : Math.round((presetWheel.idx * (maxDots - 1)) / Math.max(1, total - 1));

  // 垂直拖曳视觉
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

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 twh-sheet"
            style={{
              height: '52vh',
              animation: 'sheet-up 0.32s var(--ease-out-soft) both',
              paddingBottom: 'env(safe-area-inset-bottom)',
              transform: `translateY(${closeDragY}px)`,
              transition: closeStartY.current == null ? 'transform 0.25s var(--ease-out-soft)' : 'none',
            }}
          >
            <div className="twh-glow" aria-hidden />

            {/* header：drag handle 用于下拉关闭，整个区域可触发 */}
            <div className="twh-header flex-shrink-0"
              onPointerDown={onCloseDragDown}
              onPointerMove={onCloseDragMove}
              onPointerUp={onCloseDragUp}
              onPointerCancel={cancelCloseDrag}
              style={{ touchAction: 'none' }}
            >
              <div className="twh-header-left">
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[18px] leading-none mt-0.5">記一筆</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (closeDragMoved.current) return;
                  api.clearDuplicate();
                  setCreateOpen(true);
                }}
                className="twh-icon-btn"
                aria-label="new preset"
              >＋</button>
            </div>

            {/* mode wheel：3 个 mode 横向 cover-flow + 可点 */}
            <div className="flex-shrink-0 twh-mode-strip">
              <div className="twh-mode-highlight" aria-hidden />
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
                  const scale = Math.max(0.7, 1 - distC * 0.18);
                  const opacity = Math.max(0.2, Math.min(1, 1 - distC * 0.55));
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
                        transform: `translate(-50%, -50%) translateX(${visualPos}px) scale(${scale})`,
                        opacity,
                      }}
                    >
                      <span className="twh-mode-label">{m.label}</span>
                      <span className="twh-mode-sub">{m.sub}</span>
                    </button>
                  );
                })}
              </div>
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
                  <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="twh-empty-cta">＋ new</button>
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
                      const yOffset = isCenter ? verticalDrag * 0.35 : 0;
                      return (
                        <div key={`${p.id}-${rel}`}
                          className={`twh-card ${isCenter ? 'twh-card-active' : ''}`}
                          style={{
                            transform: `translate(${visualPos}px, ${yOffset}px) scale(${scale})`,
                            opacity,
                          }}
                        >
                          {isCenter && tickPulse > 0 && (
                            <span key={`tk-${tickPulse}`} className="twh-card-tick" aria-hidden />
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

            {/* page dots（不含 idx/total 文字） */}
            {currentMode !== 'camera' && presetList.length > 0 && (
              <div className="flex-shrink-0 twh-pager">
                {Array.from({ length: dotsToShow }).map((_, k) => (
                  <span key={k} className={`twh-pdot ${k === activeDot ? 'twh-pdot-active' : ''}`} />
                ))}
              </div>
            )}

            <div className="flex-shrink-0 px-5 pb-3 pt-2">
              <button onClick={onRec} disabled={(currentMode !== 'camera' && !currentPreset) || api.recordingId != null} className="twh-rec">
                {api.recordingId ? 'recording…' : currentMode === 'camera' ? '📷 拍照' : '● 記錄這一筆'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PresetCrudModals
        api={api} currentPreset={currentPreset}
        menuOpen={false} setMenuOpen={() => {}}
        createOpen={createOpen} setCreateOpen={setCreateOpen}
        editOpen={editOpen} setEditOpen={setEditOpen}
        delOpen={delOpen} setDelOpen={setDelOpen}
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

/* ========== 入口按钮 ========== */
.twh-knob {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 50px; height: 50px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(40,40,48,0.95), rgba(18,18,22,0.95));
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow:
    0 10px 24px -6px rgba(0,0,0,0.7),
    0 0 0 4px rgba(200,255,0,0.08),
    inset 0 1px 0 rgba(255,255,255,0.06);
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
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(200,255,0,0.06) 0%, transparent 60%),
    linear-gradient(180deg, #14141a 0%, #0a0a0d 100%);
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

/* ========== header（drag close handle） ========== */
.twh-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 8px;
  user-select: none;
  cursor: grab;
}
.twh-header:active { cursor: grabbing; }
.twh-header-left {
  pointer-events: none;
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

/* ========== mode strip (cover-flow) ========== */
.twh-mode-strip {
  position: relative;
  height: 64px;
  margin: 0 0 8px;
  overflow: hidden;
  user-select: none;
}
.twh-mode-highlight {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: ${MODE_W - 10}px;
  height: 50px;
  border: 1px solid rgba(200,255,0,0.5);
  border-radius: 14px;
  background: rgba(200,255,0,0.05);
  box-shadow:
    inset 0 0 0 1px rgba(200,255,0,0.06),
    0 0 16px rgba(200,255,0,0.15);
  pointer-events: none;
  z-index: 1;
}
.twh-mode-mask-l, .twh-mode-mask-r {
  position: absolute; top: 0; bottom: 0; width: 60px;
  pointer-events: none; z-index: 2;
}
.twh-mode-mask-l { left: 0; background: linear-gradient(90deg, #0a0a0d 0%, rgba(10,10,13,0.7) 50%, transparent 100%); }
.twh-mode-mask-r { right: 0; background: linear-gradient(-90deg, #0a0a0d 0%, rgba(10,10,13,0.7) 50%, transparent 100%); }
.twh-mode-track {
  position: absolute;
  left: 0; right: 0; top: 0; bottom: 0;
  cursor: grab;
}
.twh-mode-track:active { cursor: grabbing; }
.twh-mode-cell {
  position: absolute;
  left: 50%; top: 50%;
  /* transform 在 inline style，包含 translate(-50%,-50%) translateX(visualPos) scale(...) */
  width: ${MODE_W - 14}px;
  background: transparent;
  border: none;
  color: var(--color-text-2);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 3px;
  padding: 6px 4px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  cursor: pointer;
  will-change: transform, opacity;
}
.twh-mode-label {
  font-size: 19px;
  font-weight: 600;
  line-height: 1;
}
.twh-mode-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.5;
  line-height: 1;
}
.twh-mode-cell-active {
  color: var(--color-accent);
}
.twh-mode-cell-active .twh-mode-sub { opacity: 0.75; }

/* ========== preset cover flow ========== */
.twh-cover-wrap {
  position: relative;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.twh-cover-mask-l, .twh-cover-mask-r {
  position: absolute; top: 0; bottom: 0; width: 70px;
  pointer-events: none; z-index: 3;
}
.twh-cover-mask-l { left: 0; background: linear-gradient(90deg, #0a0a0d 0%, rgba(10,10,13,0.6) 60%, transparent 100%); }
.twh-cover-mask-r { right: 0; background: linear-gradient(-90deg, #0a0a0d 0%, rgba(10,10,13,0.6) 60%, transparent 100%); }
.twh-cover-track {
  position: relative;
  width: ${CARD_W}px;
  height: 130px;
  cursor: grab;
}
.twh-cover-track:active { cursor: grabbing; }
.twh-card {
  position: absolute;
  left: 0; top: 50%;
  width: ${CARD_W - 16}px;
  height: 118px;
  margin-top: -59px;
  background: linear-gradient(180deg, rgba(28,28,36,0.7) 0%, rgba(18,18,24,0.7) 100%);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  padding: 10px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  will-change: transform, opacity;
  backdrop-filter: blur(6px);
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
  box-shadow:
    0 14px 32px -12px rgba(0,0,0,0.7),
    0 0 28px rgba(200,255,0,0.18),
    inset 0 1px 0 rgba(200,255,0,0.12);
}
.twh-card-active .twh-card-name { color: var(--color-accent); font-size: 18px; }
.twh-card-active .twh-card-kcal { color: var(--color-accent); font-size: 24px; }

/* detent 视觉脉冲（iOS 无 vibrate 时的 fallback） */
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
.twh-card-tick {
  position: absolute; inset: 0;
  border-radius: 16px;
  pointer-events: none;
  animation: twh-tick-pulse 0.18s ease-out forwards;
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
.twh-swipe-hint-top { top: 8px; }
.twh-swipe-hint-bottom { bottom: 8px; flex-direction: column-reverse; }
.twh-swipe-hint-bottom .twh-swipe-hint-arrow { margin-top: 2px; margin-bottom: 0; }

/* ========== page dots ========== */
.twh-pager {
  display: flex; gap: 6px; align-items: center; justify-content: center;
  padding: 2px 0 6px;
}
.twh-pdot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.twh-pdot-active {
  background: var(--color-accent);
  transform: scale(1.35);
  box-shadow: 0 0 8px rgba(200,255,0,0.7);
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

/* ========== record button ========== */
.twh-rec {
  width: 100%;
  background: linear-gradient(180deg, #d4ff1a 0%, #b8e600 100%);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 14px;
  padding: 14px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  box-shadow:
    0 10px 24px -8px rgba(200,255,0,0.5),
    inset 0 1px 0 rgba(255,255,255,0.3),
    inset 0 -1px 0 rgba(0,0,0,0.15);
  transition: transform 0.12s, box-shadow 0.2s;
}
.twh-rec:active { transform: scale(0.98); box-shadow: 0 6px 14px -6px rgba(200,255,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2); }
.twh-rec:disabled { opacity: 0.35; box-shadow: none; cursor: not-allowed; }
`;
