'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { useWheelPicker } from '../_lib/wheel-picker';
import { useDelayedCommit } from '../_lib/use-delayed-commit';
import { useHWheelPicker, PresetCrudModals, MODES, presetListForMode } from '../_lib/picker-shared';
import type { HomeSnapshot } from '@/lib/home-snapshot';

/**
 * v34 左竖 + 右横：左侧 mode 垂直 wheel + 右侧 preset 横向 carousel。
 */
const MODE_H = 60;
const CARD_W = 200;
const LONG_PRESS_MS = 450;
const COMMIT_DELAY = 1200;

export function LeftVertContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const modeWheel = useWheelPicker(MODES.length, MODE_H);
  const exploreModeIdx = modeWheel.idx;
  const committedModeIdx = useDelayedCommit(exploreModeIdx, COMMIT_DELAY);
  const committedMode = MODES[committedModeIdx]!.key;
  const isExploring = exploreModeIdx !== committedModeIdx;

  const presetList = useMemo(() => presetListForMode(api.presets, committedMode), [api.presets, committedMode]);
  const presetWheel = useHWheelPicker(presetList.length, CARD_W);
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
    <PrototypeShell title="4. Left Vert + Right Carousel">
      <RealHomeShell api={api} rightAction={null} />

      <button type="button" onClick={() => setOpen(true)} aria-label="open left-vert" className="z-[70]"
        style={{ position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <span className="lv-knob">
          <span className="lv-knob-rule" aria-hidden />
          <span className="lv-knob-arrow" aria-hidden>›</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 lv-sheet"
            style={{ height: '66vh', animation: 'sheet-up 0.32s var(--ease-out-soft) both', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="lv-handle" />
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[20px] leading-none mt-0.5">vertical · carousel</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="lv-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            <div className="flex-1 px-3 grid grid-cols-[110px_1fr] gap-2 min-h-0">
              {/* 左侧 mode 垂直 wheel */}
              <div className="lv-mode-wrap relative">
                <div className="lv-mode-highlight" aria-hidden />
                <div className="lv-mode-mask-t" aria-hidden />
                <div className="lv-mode-mask-b" aria-hidden />
                <div className="lv-mode-track" {...modeWheel.pointerHandlers} style={{ touchAction: 'none' }}>
                  {MODES.map((m, i) => {
                    const offset = i - exploreModeIdx;
                    const isCenter = i === exploreModeIdx;
                    const isCommit = i === committedModeIdx;
                    return (
                      <div key={m.key}
                        className={`lv-mode-cell ${isCenter ? 'lv-mode-cell-center' : ''} ${isCommit ? 'lv-mode-cell-commit' : ''}`}
                        style={{
                          transform: `translateY(${offset * MODE_H + modeWheel.dragOffset}px)`,
                          opacity: Math.abs(offset) === 0 ? 1 : Math.abs(offset) === 1 ? 0.4 : 0.15,
                        }}
                      >
                        <span className="lv-mode-label">{m.label}</span>
                        <span className="lv-mode-sub">{m.sub}</span>
                      </div>
                    );
                  })}
                </div>
                {isExploring && <p className="lv-exploring">tune</p>}
              </div>

              {/* 右侧 preset 横向 carousel */}
              <div className="lv-cover-wrap relative">
                {committedMode === 'camera' ? (
                  <div className="lv-camera">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-text-3 mt-2">camera</p>
                  </div>
                ) : presetList.length === 0 ? (
                  <div className="lv-empty">
                    <p className="text-[13px] text-text-3 font-mono">no preset</p>
                    <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="lv-empty-cta">＋ new</button>
                  </div>
                ) : (
                  <>
                    <div className="lv-cover-mask-l" aria-hidden />
                    <div className="lv-cover-mask-r" aria-hidden />
                    <div className="lv-cover-track"
                      onPointerDown={onPresetPointerDown}
                      onPointerMove={onPresetPointerMove}
                      onPointerUp={onPresetPointerUp}
                      onPointerCancel={(e) => { clearTimer(); presetWheel.pointerHandlers.onPointerCancel(e); }}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ touchAction: 'none' }}
                    >
                      {[-1, 0, 1].map((offset) => {
                        const p = presetList[presetWheel.getOffsetIdx(offset)];
                        if (!p) return null;
                        const isCenter = offset === 0;
                        const dist = Math.abs(offset);
                        return (
                          <div key={`${p.id}-${offset}`}
                            className={`lv-card ${isCenter ? 'lv-card-active' : ''}`}
                            style={{
                              transform: `translateX(${offset * CARD_W + presetWheel.dragOffset}px) scale(${1 - dist * 0.1})`,
                              opacity: dist === 0 ? 1 : 0.4,
                            }}
                          >
                            <p className="lv-card-name">{p.name}</p>
                            <p className="lv-card-kcal tabular">{Math.round(p.kcal)}<span className="text-[10px] text-text-3 ml-1">kcal</span></p>
                            {isCenter && (
                              <p className="lv-card-macro tabular">
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
                    <p className="lv-count tabular">{presetWheel.idx + 1} / {presetList.length}</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 px-5 pt-2 pb-3">
              <button onClick={onRec} disabled={(committedMode !== 'camera' && !currentPreset) || api.recordingId != null} className="lv-rec">
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
@keyframes lv-arrow-pulse {
  0%, 100% { transform: translateX(0); opacity: 1; }
  50% { transform: translateX(3px); opacity: 0.5; }
}

/* 按钮 = 竖向刻度 + 横向箭头 */
.lv-knob {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  gap: 4px;
  width: 48px; height: 48px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 18px -4px rgba(0,0,0,0.7);
}
.lv-knob:active { transform: scale(0.92); }
.lv-knob-rule {
  display: block;
  width: 2px; height: 28px;
  background: var(--color-accent);
  opacity: 0.7;
  border-radius: 999px;
  background-image: repeating-linear-gradient(0deg, var(--color-accent) 0 2px, transparent 2px 6px);
  background-size: 2px 6px;
  background-clip: content-box;
}
.lv-knob-arrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-accent);
  line-height: 1;
  animation: lv-arrow-pulse 2.4s ease-in-out infinite;
}

.lv-sheet {
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #161620 0%, #0e0e12 100%);
  border-top: 1px solid var(--color-accent);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
}
.lv-handle {
  width: 36px; height: 4px;
  background: var(--color-hairline-strong);
  border-radius: 999px;
  margin: 8px auto 4px;
}
.lv-icon-btn {
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
.lv-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }

/* 左侧 mode wheel */
.lv-mode-wrap {
  height: 100%;
  border-right: 1px solid var(--color-hairline);
  overflow: hidden;
}
.lv-mode-highlight {
  position: absolute; left: 0; right: 0;
  top: 50%; transform: translateY(-50%);
  height: ${MODE_H}px;
  border-top: 1px solid var(--color-accent);
  border-bottom: 1px solid var(--color-accent);
  background: rgba(200,255,0,0.06);
  z-index: 1;
  pointer-events: none;
}
.lv-mode-mask-t, .lv-mode-mask-b {
  position: absolute; left: 0; right: 0;
  pointer-events: none; z-index: 2;
}
.lv-mode-mask-t { top: 0; height: 70px; background: linear-gradient(180deg, #161620 0%, rgba(22,22,32,0.7) 60%, transparent 100%); }
.lv-mode-mask-b { bottom: 0; height: 70px; background: linear-gradient(0deg, #161620 0%, rgba(22,22,32,0.7) 60%, transparent 100%); }
.lv-mode-track {
  position: absolute; inset: 0;
  cursor: grab;
}
.lv-mode-track:active { cursor: grabbing; }
.lv-mode-cell {
  position: absolute; left: 0; right: 0;
  top: 50%; margin-top: -${MODE_H / 2}px;
  height: ${MODE_H}px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  transition: opacity 0.18s, transform 0.18s;
}
.lv-mode-label {
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1;
}
.lv-mode-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--color-text-3);
  margin-top: 2px;
}
.lv-mode-cell-center .lv-mode-label { font-size: 22px; }
.lv-mode-cell-commit .lv-mode-label { color: var(--color-accent); font-weight: 700; }
.lv-mode-cell-commit .lv-mode-sub { color: var(--color-accent); opacity: 0.7; }

.lv-exploring {
  position: absolute; left: 50%; bottom: 8px;
  transform: translateX(-50%);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: rgba(200,255,0,0.6);
  letter-spacing: 0.16em;
  text-transform: lowercase;
  z-index: 4;
}

/* 右侧 cover-flow */
.lv-cover-wrap {
  position: relative;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.lv-cover-mask-l, .lv-cover-mask-r {
  position: absolute; top: 0; bottom: 0; width: 40px;
  pointer-events: none; z-index: 3;
}
.lv-cover-mask-l { left: 0; background: linear-gradient(90deg, #0e0e12 0%, transparent 100%); }
.lv-cover-mask-r { right: 0; background: linear-gradient(-90deg, #0e0e12 0%, transparent 100%); }
.lv-cover-track {
  position: relative;
  width: ${CARD_W}px;
  height: 160px;
  cursor: grab;
}
.lv-cover-track:active { cursor: grabbing; }
.lv-card {
  position: absolute;
  left: 0; top: 50%;
  width: ${CARD_W - 20}px;
  height: 144px;
  margin-top: -72px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 12px;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  padding: 12px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  transition: opacity 0.18s, transform 0.18s;
}
.lv-card-name {
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
.lv-card-kcal {
  font-size: 24px;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  margin-top: 6px;
}
.lv-card-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  margin-top: 8px;
  letter-spacing: 0.04em;
}
.lv-card-active {
  background: linear-gradient(180deg, rgba(28,28,34,0.95) 0%, rgba(20,20,26,1) 100%);
  border-color: var(--color-accent);
  box-shadow: 0 12px 28px -10px rgba(0,0,0,0.7), 0 0 24px rgba(200,255,0,0.18);
}
.lv-card-active .lv-card-name { color: var(--color-accent); font-size: 18px; }
.lv-card-active .lv-card-kcal { color: var(--color-accent); font-size: 28px; }

.lv-count {
  position: absolute;
  right: 8px; bottom: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  z-index: 4;
}

.lv-camera, .lv-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-accent);
  gap: 10px;
}
.lv-empty-cta {
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

.lv-rec {
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
.lv-rec:active { transform: scale(0.98); }
.lv-rec:disabled { opacity: 0.4; }
`;
