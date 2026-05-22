'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { useWheelPicker } from '../_lib/wheel-picker';
import { useDelayedCommit } from '../_lib/use-delayed-commit';
import { PresetCrudModals, MODES, presetListForMode } from '../_lib/picker-shared';
import type { HomeSnapshot } from '@/lib/home-snapshot';

/**
 * v32 Split Dial：左侧半圆 mode dial + 右侧 preset 垂直 stack。
 * 拇指在半圆 dial 上做弧线拖动，指针连续旋转，停 1.2s 余辉闪 → 提交切换右侧。
 */
const ITEM_HEIGHT = 56;
const VISIBLE_BEFORE = 2;
const VISIBLE_AFTER = 2;
const LONG_PRESS_MS = 450;
const COMMIT_DELAY = 1200;
const ARC_STEP_DEG = 36;

export function DialContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [exploreModeIdx, setExploreModeIdx] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commitFlash, setCommitFlash] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const committedModeIdx = useDelayedCommit(exploreModeIdx, COMMIT_DELAY);
  const committedMode = MODES[committedModeIdx]!.key;

  // 提交时触发余辉 flash
  const lastCommittedRef = useRef(committedModeIdx);
  if (committedModeIdx !== lastCommittedRef.current) {
    lastCommittedRef.current = committedModeIdx;
    setTimeout(() => { setCommitFlash(true); setTimeout(() => setCommitFlash(false), 320); }, 0);
  }

  // 半圆 dial 手势
  const dialRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const accumRef = useRef<number>(0);

  function angleFromCenter(x: number, y: number): number {
    const el = dialRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return (Math.atan2(y - (rect.top + rect.height / 2), x - (rect.left + rect.width / 2)) * 180) / Math.PI;
  }

  function onDialTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]!;
    lastAngleRef.current = angleFromCenter(t.clientX, t.clientY);
    accumRef.current = 0;
  }
  function onDialTouchMove(e: React.TouchEvent) {
    if (lastAngleRef.current == null) return;
    const t = e.touches[0]!;
    const a = angleFromCenter(t.clientX, t.clientY);
    let diff = a - lastAngleRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    lastAngleRef.current = a;
    accumRef.current += diff;
    while (Math.abs(accumRef.current) >= ARC_STEP_DEG) {
      const dir = accumRef.current > 0 ? 1 : -1;
      accumRef.current -= dir * ARC_STEP_DEG;
      setExploreModeIdx((i) => ((i + dir) % MODES.length + MODES.length) % MODES.length);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
    }
  }
  function onDialTouchEnd() {
    lastAngleRef.current = null;
    accumRef.current = 0;
  }

  const presetList = useMemo(() => presetListForMode(api.presets, committedMode), [api.presets, committedMode]);
  const presetWheel = useWheelPicker(presetList.length, ITEM_HEIGHT);
  const currentPreset = presetList[presetWheel.idx];
  const isExploring = exploreModeIdx !== committedModeIdx;

  function clearTimer() {
    if (longPressRef.current != null) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
  }
  function onPresetPointerDown(e: React.PointerEvent) {
    presetWheel.pointerHandlers.onPointerDown(e);
    longPressFiredRef.current = false;
    clearTimer();
    if (committedMode === 'menu') {
      longPressRef.current = window.setTimeout(() => {
        longPressFiredRef.current = true;
        setMenuOpen(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      }, LONG_PRESS_MS);
    }
  }
  function onPresetPointerMove(e: React.PointerEvent) {
    presetWheel.pointerHandlers.onPointerMove(e);
    if (Math.abs(presetWheel.dragOffset) > 6) clearTimer();
  }
  function onPresetPointerUp(e: React.PointerEvent) {
    clearTimer();
    presetWheel.pointerHandlers.onPointerUp(e);
  }
  async function onRec() {
    if (committedMode === 'camera') return;
    if (currentPreset) {
      const ok = await api.recordCustomPreset(currentPreset);
      if (ok) setOpen(false);
    }
  }

  // 指针角度：基于 exploreModeIdx，等分 -100° ~ +100° 半圆
  const pointerDeg = -100 + (exploreModeIdx / Math.max(1, MODES.length - 1)) * 200;

  return (
    <PrototypeShell title="2. Split Dial">
      <RealHomeShell api={api} rightAction={null} />

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open split dial"
        className="z-[70]"
        style={{ position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <span className="dial-knob">
          <svg viewBox="0 0 32 32" className="dial-knob-svg" aria-hidden>
            <path d="M 6 10 A 12 12 0 0 1 12 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 20 5 A 12 12 0 0 1 26 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 27 19 A 12 12 0 0 1 17 27" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            <line x1="16" y1="16" x2="22" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 bottom-0 dial-sheet"
            style={{ height: '70vh', animation: 'sheet-up 0.32s var(--ease-out-soft) both', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="dial-handle" />
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[20px] leading-none mt-0.5">split dial</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="dial-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            <div className="flex-1 px-3 grid grid-cols-[44%_56%] gap-3 min-h-0">
              {/* 左侧半圆 dial */}
              <div className="dial-left">
                <div
                  ref={dialRef}
                  onTouchStart={onDialTouchStart}
                  onTouchMove={onDialTouchMove}
                  onTouchEnd={onDialTouchEnd}
                  onTouchCancel={onDialTouchEnd}
                  className={`dial-arena ${commitFlash ? 'dial-arena-flash' : ''}`}
                  style={{ touchAction: 'none' }}
                >
                  {/* mode 标签沿半圆排列 */}
                  {MODES.map((m, i) => {
                    const angle = -100 + (i / Math.max(1, MODES.length - 1)) * 200;
                    const isExplore = i === exploreModeIdx;
                    const isCommit = i === committedModeIdx;
                    return (
                      <span
                        key={m.key}
                        className={`dial-mode-label ${isExplore ? 'dial-mode-label-explore' : ''} ${isCommit ? 'dial-mode-label-commit' : ''}`}
                        style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(98px) rotate(${-angle}deg)` }}
                      >
                        {m.label}
                      </span>
                    );
                  })}

                  {/* 指针 */}
                  <div
                    className={`dial-needle ${isExploring ? 'dial-needle-hollow' : ''}`}
                    style={{ transform: `translate(-50%, -100%) rotate(${pointerDeg}deg)` }}
                    aria-hidden
                  />
                  {/* 中央 hub */}
                  <div className="dial-hub" aria-hidden>
                    <span className="dial-hub-glyph">{committedMode === 'recent' ? 'R' : committedMode === 'menu' ? 'M' : 'C'}</span>
                  </div>
                  {/* 半圆 arc */}
                  <svg className="dial-arc" viewBox="-110 -110 220 110" aria-hidden>
                    <path d="M -100 0 A 100 100 0 0 1 100 0" fill="none" stroke="var(--color-hairline-strong)" strokeWidth="1.5" />
                  </svg>
                </div>
                <p className="dial-status">
                  {isExploring ? <span className="dial-status-explore">tune: {MODES[exploreModeIdx]!.label}</span> : <span className="dial-status-commit">▸ {MODES[committedModeIdx]!.label}</span>}
                </p>
              </div>

              {/* 右侧 stack */}
              <div className="dial-right relative">
                {committedMode === 'camera' ? (
                  <div className="dial-camera">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-text-3 mt-2">camera mode</p>
                  </div>
                ) : presetList.length === 0 ? (
                  <div className="dial-empty">
                    <p className="text-[12px] text-text-3 font-mono">no preset</p>
                    <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="dial-empty-cta">＋ new</button>
                  </div>
                ) : (
                  <div className="dial-stack-wrap">
                    <div className="dial-stack-highlight" aria-hidden />
                    <div className="dial-stack-mask-t" aria-hidden />
                    <div className="dial-stack-mask-b" aria-hidden />
                    <div
                      className="dial-stack"
                      onPointerDown={onPresetPointerDown}
                      onPointerMove={onPresetPointerMove}
                      onPointerUp={onPresetPointerUp}
                      onPointerCancel={(e) => { clearTimer(); presetWheel.pointerHandlers.onPointerCancel(e); }}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ touchAction: 'none' }}
                    >
                      {Array.from({ length: VISIBLE_BEFORE + 1 + VISIBLE_AFTER }, (_, i) => {
                        const offset = i - VISIBLE_BEFORE;
                        const p = presetList[presetWheel.getOffsetIdx(offset)];
                        if (!p) return null;
                        const dist = Math.abs(offset);
                        const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.16;
                        return (
                          <div
                            key={`${p.id}-${offset}`}
                            className={`dial-row ${offset === 0 ? 'dial-row-active' : ''}`}
                            style={{
                              transform: `translateY(${offset * ITEM_HEIGHT + presetWheel.dragOffset}px)`,
                              opacity,
                              height: ITEM_HEIGHT,
                            }}
                          >
                            <p className="dial-row-name">{p.name}</p>
                            <p className="dial-row-kcal tabular">{Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {currentPreset && committedMode !== 'camera' && (
              <p className="flex-shrink-0 px-5 text-center font-mono text-[11px] tabular mb-2 mt-1">
                <span style={{ color: '#c8ff00' }}>P {Math.round(currentPreset.protein_g)}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#f5a623' }}>C {Math.round(currentPreset.carb_g)}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#a486f4' }}>F {Math.round(currentPreset.fat_g)}</span>
              </p>
            )}

            <div className="flex-shrink-0 px-5 pb-3">
              <button onClick={onRec} disabled={(committedMode !== 'camera' && !currentPreset) || api.recordingId != null} className="dial-rec">
                {api.recordingId ? 'recording…' : committedMode === 'camera' ? '📷 拍照' : '● 記錄這一筆'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PresetCrudModals
        api={api} currentPreset={currentPreset}
        menuOpen={menuOpen && committedMode === 'menu'} setMenuOpen={setMenuOpen}
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
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
@keyframes dial-knob-swing {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg); }
}
@keyframes dial-arena-flash {
  0% { box-shadow: 0 0 0 0 rgba(200,255,0,0); }
  35% { box-shadow: 0 0 32px 4px rgba(200,255,0,0.4); }
  100% { box-shadow: 0 0 0 0 rgba(200,255,0,0); }
}

.dial-knob {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  color: var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 18px -4px rgba(0,0,0,0.7);
}
.dial-knob-svg {
  width: 28px;
  height: 28px;
  animation: dial-knob-swing 3.4s ease-in-out infinite;
}
.dial-knob:active { transform: scale(0.92); }

.dial-sheet {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #161620 0%, #0e0e12 100%);
  border-top: 1px solid var(--color-accent);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  box-shadow: 0 -22px 50px -10px rgba(0,0,0,0.7);
}
.dial-handle {
  width: 36px; height: 4px;
  background: var(--color-hairline-strong);
  border-radius: 999px;
  margin: 8px auto 4px;
}
.dial-icon-btn {
  width: 30px; height: 30px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.dial-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }

/* 半圆 dial */
.dial-left {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative;
}
.dial-arena {
  position: relative;
  width: 220px; height: 130px;
  margin-top: 8px;
  border-radius: 8px;
  transition: box-shadow 0.32s;
}
.dial-arena-flash { animation: dial-arena-flash 0.32s ease-out; }
.dial-arc {
  position: absolute;
  left: 50%; bottom: 0;
  transform: translateX(-50%);
  width: 220px; height: 110px;
}
.dial-mode-label {
  position: absolute;
  left: 50%; bottom: 0;
  transform-origin: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  pointer-events: none;
  white-space: nowrap;
  letter-spacing: 0.04em;
  transition: color 0.18s, font-size 0.18s;
}
.dial-mode-label-explore { color: rgba(200,255,0,0.7); font-size: 13px; }
.dial-mode-label-commit { color: var(--color-accent); font-weight: 700; font-size: 14px; }

.dial-needle {
  position: absolute;
  left: 50%; bottom: 0;
  width: 3px; height: 88px;
  background: var(--color-accent);
  transform-origin: bottom center;
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(200,255,0,0.6);
  transition: transform 0.18s var(--ease-out-soft), background 0.18s, opacity 0.18s;
}
.dial-needle-hollow {
  background: transparent;
  border-left: 1.5px solid var(--color-accent);
  border-right: 1.5px solid var(--color-accent);
  box-shadow: none;
  opacity: 0.7;
}
.dial-hub {
  position: absolute;
  left: 50%; bottom: -14px;
  transform: translateX(-50%);
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2a2a32 0%, #15151a 100%);
  border: 1.5px solid var(--color-accent);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 4px rgba(200,255,0,0.08), 0 4px 10px rgba(0,0,0,0.5);
}
.dial-hub-glyph {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent);
}

.dial-status {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  margin-top: 18px;
  text-transform: lowercase;
  white-space: nowrap;
}
.dial-status-explore { color: rgba(200,255,0,0.6); }
.dial-status-commit { color: var(--color-accent); }

/* 右侧 stack */
.dial-right {
  position: relative;
  height: 100%;
  display: flex;
  align-items: stretch;
}
.dial-stack-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.dial-stack-highlight {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: ${ITEM_HEIGHT}px;
  border-top: 1px solid var(--color-accent);
  border-bottom: 1px solid var(--color-accent);
  background: rgba(200, 255, 0, 0.05);
  pointer-events: none;
  z-index: 2;
}
.dial-stack-mask-t, .dial-stack-mask-b {
  position: absolute;
  left: 0; right: 0;
  pointer-events: none;
  z-index: 3;
}
.dial-stack-mask-t {
  top: 0;
  height: ${ITEM_HEIGHT * VISIBLE_BEFORE}px;
  background: linear-gradient(180deg, #0e0e12 0%, rgba(14,14,18,0.7) 60%, transparent 100%);
}
.dial-stack-mask-b {
  bottom: 0;
  height: ${ITEM_HEIGHT * VISIBLE_AFTER}px;
  background: linear-gradient(0deg, #0e0e12 0%, rgba(14,14,18,0.7) 60%, transparent 100%);
}
.dial-stack {
  position: absolute; inset: 0;
  cursor: grab; z-index: 1;
}
.dial-stack:active { cursor: grabbing; }
.dial-row {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 14px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  transition: opacity 0.18s, transform 0.18s;
}
.dial-row-name {
  font-size: 15px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dial-row-kcal {
  font-size: 13px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}
.dial-row-active .dial-row-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-accent);
}
.dial-row-active .dial-row-kcal {
  font-size: 14px;
  color: var(--color-accent);
}

.dial-camera, .dial-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-accent);
  gap: 8px;
}
.dial-empty-cta {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.12em;
  cursor: pointer;
}

.dial-rec {
  width: 100%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  box-shadow: 0 8px 20px -6px rgba(200,255,0,0.4);
}
.dial-rec:active { transform: scale(0.98); }
.dial-rec:disabled { opacity: 0.4; }
`;
