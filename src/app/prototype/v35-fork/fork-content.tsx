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
 * v35 Tuning Fork：左竖 mode tuning rail（音叉视觉）+ 右竖 preset deck。
 * 探索态：右侧 deck 边缘 lime scanline；停 1.2s 提交时 deck 短促"调频抖动"+ 内容切换。
 */
const MODE_H = 56;
const ITEM_HEIGHT = 56;
const VISIBLE = 2;
const LONG_PRESS_MS = 450;
const COMMIT_DELAY = 1200;

export function ForkContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commitShake, setCommitShake] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const modeWheel = useWheelPicker(MODES.length, MODE_H);
  const exploreModeIdx = modeWheel.idx;
  const committedModeIdx = useDelayedCommit(exploreModeIdx, COMMIT_DELAY);
  const committedMode = MODES[committedModeIdx]!.key;
  const isExploring = exploreModeIdx !== committedModeIdx;

  // 提交时触发 deck 抖动
  const lastCommittedRef = useRef(committedModeIdx);
  if (committedModeIdx !== lastCommittedRef.current) {
    lastCommittedRef.current = committedModeIdx;
    setTimeout(() => { setCommitShake(true); setTimeout(() => setCommitShake(false), 360); }, 0);
  }

  const presetList = useMemo(() => presetListForMode(api.presets, committedMode), [api.presets, committedMode]);
  const presetWheel = useWheelPicker(presetList.length, ITEM_HEIGHT);
  const currentPreset = presetList[presetWheel.idx];

  function clearTimer() { if (longPressRef.current != null) { window.clearTimeout(longPressRef.current); longPressRef.current = null; } }
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
  function onPresetPointerMove(e: React.PointerEvent) { presetWheel.pointerHandlers.onPointerMove(e); if (Math.abs(presetWheel.dragOffset) > 6) clearTimer(); }
  function onPresetPointerUp(e: React.PointerEvent) { clearTimer(); presetWheel.pointerHandlers.onPointerUp(e); }
  async function onRec() {
    if (committedMode === 'camera') return;
    if (currentPreset) { const ok = await api.recordCustomPreset(currentPreset); if (ok) setOpen(false); }
  }

  return (
    <PrototypeShell title="5. Tuning Fork">
      <RealHomeShell api={api} rightAction={null} />

      <button type="button" onClick={() => setOpen(true)} aria-label="open tuning fork" className="z-[70]"
        style={{ position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <span className="fork-knob">
          <span className="fork-prong fork-prong-l" aria-hidden />
          <span className="fork-prong fork-prong-r" aria-hidden />
          <span className="fork-handle" aria-hidden />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 fork-sheet"
            style={{ height: '68vh', animation: 'sheet-up 0.32s var(--ease-out-soft) both', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="fork-handle-strip" />
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[20px] leading-none mt-0.5">tuning fork</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="fork-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            <div className="flex-1 px-3 grid grid-cols-[42%_58%] gap-3 min-h-0">
              {/* 左 mode tuning rail */}
              <div className="fork-rail-wrap">
                <div className="fork-tuning-line" aria-hidden />
                <div className="fork-rail-mask-t" aria-hidden />
                <div className="fork-rail-mask-b" aria-hidden />
                <div className="fork-rail-track" {...modeWheel.pointerHandlers} style={{ touchAction: 'none' }}>
                  {MODES.map((m, i) => {
                    const offset = i - exploreModeIdx;
                    const isCenter = i === exploreModeIdx;
                    const isCommit = i === committedModeIdx;
                    return (
                      <div key={m.key}
                        className={`fork-rail-cell ${isCenter ? 'fork-rail-cell-center' : ''} ${isCommit ? 'fork-rail-cell-commit' : ''}`}
                        style={{
                          transform: `translateY(${offset * MODE_H + modeWheel.dragOffset}px)`,
                          opacity: Math.abs(offset) === 0 ? 1 : Math.abs(offset) === 1 ? 0.4 : 0.15,
                        }}
                      >
                        <span className="fork-rail-label">{m.label}</span>
                        <span className="fork-rail-sub">{m.sub}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右 preset deck */}
              <div className={`fork-deck-wrap ${isExploring ? 'fork-deck-exploring' : ''} ${commitShake ? 'fork-deck-shake' : ''}`}>
                {committedMode === 'camera' ? (
                  <div className="fork-camera">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-text-3 mt-2">camera</p>
                  </div>
                ) : presetList.length === 0 ? (
                  <div className="fork-empty">
                    <p className="text-[13px] text-text-3 font-mono">no preset</p>
                    <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="fork-empty-cta">＋ new</button>
                  </div>
                ) : (
                  <>
                    <div className="fork-deck-highlight" aria-hidden />
                    <div className="fork-deck-mask-t" aria-hidden />
                    <div className="fork-deck-mask-b" aria-hidden />
                    <div className="fork-deck"
                      onPointerDown={onPresetPointerDown}
                      onPointerMove={onPresetPointerMove}
                      onPointerUp={onPresetPointerUp}
                      onPointerCancel={(e) => { clearTimer(); presetWheel.pointerHandlers.onPointerCancel(e); }}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ touchAction: 'none' }}
                    >
                      {Array.from({ length: VISIBLE * 2 + 1 }, (_, i) => {
                        const offset = i - VISIBLE;
                        const p = presetList[presetWheel.getOffsetIdx(offset)];
                        if (!p) return null;
                        const dist = Math.abs(offset);
                        return (
                          <div key={`${p.id}-${offset}`}
                            className={`fork-row ${offset === 0 ? 'fork-row-active' : ''}`}
                            style={{
                              transform: `translateY(${offset * ITEM_HEIGHT + presetWheel.dragOffset}px)`,
                              opacity: dist === 0 ? 1 : dist === 1 ? 0.45 : 0.15,
                              height: ITEM_HEIGHT,
                            }}
                          >
                            <p className="fork-row-name">{p.name}</p>
                            <p className="fork-row-kcal tabular">{Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {isExploring && <p className="fork-scan">⟳ tuning · hold to commit</p>}
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
              <button onClick={onRec} disabled={(committedMode !== 'camera' && !currentPreset) || api.recordingId != null} className="fork-rec">
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
@keyframes fork-prong-vibrate {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(0.8px); }
}
@keyframes fork-prong-vibrate-r {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-0.8px); }
}
@keyframes fork-deck-shake-kf {
  0%, 100% { transform: translateY(0); }
  20% { transform: translateY(-2px); }
  40% { transform: translateY(2px); }
  60% { transform: translateY(-1.5px); }
  80% { transform: translateY(1px); }
}
@keyframes fork-scanline {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.6; }
}

/* 按钮 = 音叉 */
.fork-knob {
  position: relative;
  display: flex;
  align-items: flex-start; justify-content: center;
  width: 48px; height: 48px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 18px -4px rgba(0,0,0,0.7);
}
.fork-knob:active { transform: scale(0.92); }
.fork-prong {
  position: absolute;
  top: 10px;
  width: 3px; height: 20px;
  background: var(--color-accent);
  border-radius: 2px;
  box-shadow: 0 0 5px rgba(200,255,0,0.7);
}
.fork-prong-l { left: 16px; animation: fork-prong-vibrate 1.4s ease-in-out infinite; }
.fork-prong-r { right: 16px; animation: fork-prong-vibrate-r 1.4s ease-in-out infinite; }
.fork-handle {
  position: absolute;
  bottom: 8px; left: 50%;
  transform: translateX(-50%);
  width: 6px; height: 12px;
  background: var(--color-accent);
  border-radius: 0 0 2px 2px;
  border-top: 2px solid rgba(200,255,0,0.4);
}

.fork-sheet {
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #161620 0%, #0e0e12 100%);
  border-top: 1px solid var(--color-accent);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
}
.fork-handle-strip {
  width: 36px; height: 4px;
  background: var(--color-hairline-strong);
  border-radius: 999px;
  margin: 8px auto 4px;
}
.fork-icon-btn {
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
.fork-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }

/* mode rail */
.fork-rail-wrap {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-right: 1px solid var(--color-hairline);
}
.fork-tuning-line {
  position: absolute;
  left: 0; right: 0;
  top: 50%; transform: translateY(-50%);
  height: 1px;
  background: var(--color-accent);
  box-shadow: 0 0 8px rgba(200,255,0,0.6);
  z-index: 2;
  pointer-events: none;
}
.fork-rail-mask-t, .fork-rail-mask-b {
  position: absolute; left: 0; right: 0;
  pointer-events: none; z-index: 3;
}
.fork-rail-mask-t { top: 0; height: 70px; background: linear-gradient(180deg, #161620 0%, transparent 100%); }
.fork-rail-mask-b { bottom: 0; height: 70px; background: linear-gradient(0deg, #161620 0%, transparent 100%); }
.fork-rail-track {
  position: absolute; inset: 0;
  cursor: grab;
}
.fork-rail-track:active { cursor: grabbing; }
.fork-rail-cell {
  position: absolute; left: 0; right: 0;
  top: 50%; margin-top: -${MODE_H / 2}px;
  height: ${MODE_H}px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  transition: opacity 0.18s;
}
.fork-rail-label {
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 18px; font-weight: 600;
  color: var(--color-text); line-height: 1;
}
.fork-rail-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--color-text-3);
  margin-top: 2px;
}
.fork-rail-cell-center .fork-rail-label { font-size: 22px; }
.fork-rail-cell-commit .fork-rail-label { color: var(--color-accent); font-weight: 700; }
.fork-rail-cell-commit .fork-rail-sub { color: var(--color-accent); opacity: 0.7; }

/* deck */
.fork-deck-wrap {
  position: relative;
  height: 100%;
  overflow: hidden;
  transition: box-shadow 0.18s;
}
.fork-deck-exploring::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(200, 255, 0, 0.4);
  pointer-events: none;
  z-index: 4;
  animation: fork-scanline 1.4s ease-in-out infinite;
}
.fork-deck-shake .fork-deck { animation: fork-deck-shake-kf 0.36s ease-in-out; }

.fork-deck-highlight {
  position: absolute; left: 0; right: 0;
  top: 50%; transform: translateY(-50%);
  height: ${ITEM_HEIGHT}px;
  border-top: 1px solid var(--color-accent);
  border-bottom: 1px solid var(--color-accent);
  background: rgba(200,255,0,0.05);
  pointer-events: none;
  z-index: 2;
}
.fork-deck-mask-t, .fork-deck-mask-b {
  position: absolute; left: 0; right: 0;
  pointer-events: none; z-index: 3;
}
.fork-deck-mask-t { top: 0; height: ${ITEM_HEIGHT * VISIBLE}px; background: linear-gradient(180deg, #0e0e12 0%, transparent 100%); }
.fork-deck-mask-b { bottom: 0; height: ${ITEM_HEIGHT * VISIBLE}px; background: linear-gradient(0deg, #0e0e12 0%, transparent 100%); }
.fork-deck {
  position: absolute; inset: 0;
  cursor: grab;
  z-index: 1;
}
.fork-deck:active { cursor: grabbing; }
.fork-row {
  position: absolute; left: 0; right: 0;
  top: 50%; margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 16px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  transition: opacity 0.18s, transform 0.18s;
}
.fork-row-name {
  font-size: 15px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fork-row-kcal {
  font-size: 13px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}
.fork-row-active .fork-row-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-accent);
}
.fork-row-active .fork-row-kcal { font-size: 14px; color: var(--color-accent); }

.fork-scan {
  position: absolute;
  right: 8px; top: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: rgba(200,255,0,0.7);
  letter-spacing: 0.12em;
  z-index: 5;
}

.fork-camera, .fork-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-accent);
  gap: 10px;
}
.fork-empty-cta {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.14em;
  cursor: pointer;
}

.fork-rec {
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
.fork-rec:active { transform: scale(0.98); }
.fork-rec:disabled { opacity: 0.4; }
`;
