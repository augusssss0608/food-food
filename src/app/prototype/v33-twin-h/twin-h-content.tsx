'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { useHWheelPicker, PresetCrudModals, MODES, presetListForMode } from '../_lib/picker-shared';
import type { HomeSnapshot } from '@/lib/home-snapshot';

const CARD_W = 200;
const TAB_SWIPE_THRESHOLD = 28; // 横向滑动多少 px 算切一格
const TAB_AXIS_LOCK = 6;        // 视为开始有意识滑动的最小位移
const PRESET_AXIS_LOCK = 8;     // preset 手势主轴判定阈值
const VERTICAL_TRIGGER = 60;    // 垂直滑动多少 px 触发编辑/删除

export function TwinHContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // 不再用，但保留 prop 以兼容 PresetCrudModals

  const [modeIdx, setModeIdx] = useState(0);
  const currentMode = MODES[modeIdx]!.key;

  const presetList = useMemo(() => presetListForMode(api.presets, currentMode), [api.presets, currentMode]);
  const presetWheel = useHWheelPicker(presetList.length, CARD_W);
  const currentPreset = presetList[presetWheel.idx];

  // —— mode tabs：点击 + 横向 swipe（一次一格）——
  const tabSwipeStart = useRef<number | null>(null);
  const tabSwipeMoved = useRef(false);
  function onTabsPointerDown(e: React.PointerEvent) {
    tabSwipeStart.current = e.clientX;
    tabSwipeMoved.current = false;
  }
  function onTabsPointerMove(e: React.PointerEvent) {
    if (tabSwipeStart.current == null) return;
    if (Math.abs(e.clientX - tabSwipeStart.current) > TAB_AXIS_LOCK) tabSwipeMoved.current = true;
  }
  function onTabsPointerUp(e: React.PointerEvent) {
    if (tabSwipeStart.current == null) return;
    const dx = e.clientX - tabSwipeStart.current;
    tabSwipeStart.current = null;
    if (Math.abs(dx) > TAB_SWIPE_THRESHOLD) {
      const dir = dx < 0 ? 1 : -1;
      setModeIdx((i) => Math.max(0, Math.min(MODES.length - 1, i + dir)));
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(6); } catch {}
      }
    }
  }
  function pickModeViaClick(i: number) {
    if (tabSwipeMoved.current) return; // 滑动手势中的 click 忽略
    setModeIdx(i);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(6); } catch {}
    }
  }

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
          // 取消 wheel 拖曳（让它弹回原位）
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

  async function onRec() {
    if (currentMode === 'camera') return;
    if (currentPreset) { const ok = await api.recordCustomPreset(currentPreset); if (ok) setOpen(false); }
  }

  // page indicator 计算
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
            style={{ height: '52vh', animation: 'sheet-up 0.32s var(--ease-out-soft) both', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="twh-glow" aria-hidden />
            <div className="twh-handle" />
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[18px] leading-none mt-0.5">記一筆</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="twh-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            {/* mode tabs */}
            <div className="flex-shrink-0 twh-tabs"
              onPointerDown={onTabsPointerDown}
              onPointerMove={onTabsPointerMove}
              onPointerUp={onTabsPointerUp}
              onPointerCancel={() => { tabSwipeStart.current = null; tabSwipeMoved.current = false; }}
              style={{ touchAction: 'none' }}
            >
              {MODES.map((m, i) => {
                const isActive = i === modeIdx;
                return (
                  <button key={m.key}
                    onClick={() => pickModeViaClick(i)}
                    className={`twh-tab ${isActive ? 'twh-tab-active' : ''}`}
                    aria-pressed={isActive}
                  >
                    <span className="twh-tab-label">{m.label}</span>
                    <span className="twh-tab-sub">{m.sub}</span>
                  </button>
                );
              })}
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

                  {/* swipe-up 删除提示 */}
                  <div className={`twh-swipe-hint twh-swipe-hint-top ${showDeleteHint ? 'twh-swipe-hint-on' : ''}`}
                    style={{ opacity: showDeleteHint ? verticalIntensity : 0 }}
                  >
                    <span className="twh-swipe-hint-arrow">↑</span>
                    <span>刪除</span>
                  </div>
                  {/* swipe-down 编辑提示 */}
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
                      // 只对 center card 加垂直跟手位移
                      const yOffset = isCenter ? verticalDrag * 0.35 : 0;
                      return (
                        <div key={`${p.id}-${rel}`}
                          className={`twh-card ${isCenter ? 'twh-card-active' : ''}`}
                          style={{
                            transform: `translate(${visualPos}px, ${yOffset}px) scale(${scale})`,
                            opacity,
                          }}
                        >
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

            {/* page indicator + 手势 hint */}
            {currentMode !== 'camera' && presetList.length > 0 && (
              <div className="flex-shrink-0 twh-pager-wrap">
                <div className="twh-pager">
                  {Array.from({ length: dotsToShow }).map((_, k) => (
                    <span key={k} className={`twh-pdot ${k === activeDot ? 'twh-pdot-active' : ''}`} />
                  ))}
                </div>
                <p className="twh-pager-text tabular">{presetWheel.idx + 1} / {total}</p>
              </div>
            )}

            <div className="flex-shrink-0 px-5 pb-3 pt-1">
              <button onClick={onRec} disabled={(currentMode !== 'camera' && !currentPreset) || api.recordingId != null} className="twh-rec">
                {api.recordingId ? 'recording…' : currentMode === 'camera' ? '📷 拍照' : '● 記錄這一筆'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PresetCrudModals
        api={api} currentPreset={currentPreset}
        menuOpen={menuOpen} setMenuOpen={setMenuOpen}
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
.twh-handle {
  width: 36px; height: 4px;
  background: linear-gradient(90deg, transparent, rgba(200,255,0,0.4), transparent);
  border-radius: 999px;
  margin: 9px auto 4px;
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

/* ========== mode tabs ========== */
.twh-tabs {
  display: flex;
  gap: 6px;
  padding: 4px 16px 12px;
  user-select: none;
}
.twh-tab {
  flex: 1;
  position: relative;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 10px 4px 8px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  color: var(--color-text-2);
  cursor: pointer;
  display: flex; flex-direction: column;
  align-items: center; gap: 3px;
  transition: background 0.22s, border-color 0.22s, color 0.22s, transform 0.12s, box-shadow 0.22s;
  overflow: hidden;
}
.twh-tab:active { transform: scale(0.96); }
.twh-tab::after {
  content: '';
  position: absolute;
  left: 50%; bottom: 5px;
  transform: translateX(-50%) scaleX(0);
  width: 18px; height: 2px;
  background: var(--color-accent);
  border-radius: 999px;
  transition: transform 0.25s var(--ease-out-soft);
  transform-origin: center;
}
.twh-tab-label {
  font-size: 17px;
  font-weight: 600;
  line-height: 1;
}
.twh-tab-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.45;
  line-height: 1;
}
.twh-tab-active {
  background: linear-gradient(180deg, rgba(200,255,0,0.16) 0%, rgba(200,255,0,0.04) 100%);
  border-color: rgba(200,255,0,0.55);
  color: var(--color-accent);
  box-shadow: inset 0 0 0 1px rgba(200,255,0,0.1), 0 6px 16px -8px rgba(200,255,0,0.4);
}
.twh-tab-active .twh-tab-sub { opacity: 0.7; }
.twh-tab-active::after { transform: translateX(-50%) scaleX(1); }

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

/* ========== page indicator ========== */
.twh-pager-wrap {
  display: flex; flex-direction: column; align-items: center;
  gap: 4px;
  padding: 2px 0 6px;
}
.twh-pager {
  display: flex; gap: 6px; align-items: center;
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
.twh-pager-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--color-text-4);
  text-transform: uppercase;
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
