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
 * v36 Crosshair Ledger（codex #3 简化版）：
 *   - 左侧 mode wheel（准星视觉：中心 lime 4 角标锁定）
 *   - 右侧 preset ledger（密集表格 + 中心行被 4 角标锁住）
 *   - 顶部 compact/macro 切换 toggle（横向密度）
 *   - 停 1.2s 准星合拢 + 提交切换
 */
type ViewMode = 'compact' | 'macro';
const MODE_H = 56;
const ROW_H = 44;
const VISIBLE = 3;
const LONG_PRESS_MS = 450;
const COMMIT_DELAY = 1200;

export function CrossContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('compact');
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const modeWheel = useWheelPicker(MODES.length, MODE_H);
  const exploreModeIdx = modeWheel.idx;
  const committedModeIdx = useDelayedCommit(exploreModeIdx, COMMIT_DELAY);
  const committedMode = MODES[committedModeIdx]!.key;
  const isExploring = exploreModeIdx !== committedModeIdx;

  const presetList = useMemo(() => presetListForMode(api.presets, committedMode), [api.presets, committedMode]);
  const presetWheel = useWheelPicker(presetList.length, ROW_H);
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
    <PrototypeShell title="6. Crosshair Ledger">
      <RealHomeShell api={api} rightAction={null} />

      <button type="button" onClick={() => setOpen(true)} aria-label="open crosshair" className="z-[70]"
        style={{ position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <span className="cross-knob">
          <span className="cross-tl" aria-hidden />
          <span className="cross-tr" aria-hidden />
          <span className="cross-bl" aria-hidden />
          <span className="cross-br" aria-hidden />
          <span className="cross-tick" aria-hidden />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 cross-sheet"
            style={{ height: '70vh', animation: 'sheet-up 0.32s var(--ease-out-soft) both', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="cross-handle" />
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[20px] leading-none mt-0.5">crosshair ledger</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setView(view === 'compact' ? 'macro' : 'compact')} className="cross-toggle">{view === 'compact' ? '◫ compact' : '⋮ macro'}</button>
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="cross-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            <div className="flex-1 px-3 grid grid-cols-[110px_1fr] gap-2 min-h-0">
              {/* 左侧 mode quadrant 锁定 */}
              <div className="cross-mode-wrap relative">
                {/* 锁定 4 角标 */}
                <span className={`cross-lock-tl ${isExploring ? 'cross-lock-open' : ''}`} aria-hidden />
                <span className={`cross-lock-tr ${isExploring ? 'cross-lock-open' : ''}`} aria-hidden />
                <span className={`cross-lock-bl ${isExploring ? 'cross-lock-open' : ''}`} aria-hidden />
                <span className={`cross-lock-br ${isExploring ? 'cross-lock-open' : ''}`} aria-hidden />
                <div className="cross-mode-mask-t" aria-hidden />
                <div className="cross-mode-mask-b" aria-hidden />
                <div className="cross-mode-track" {...modeWheel.pointerHandlers} style={{ touchAction: 'none' }}>
                  {MODES.map((m, i) => {
                    const offset = i - exploreModeIdx;
                    const isCenter = i === exploreModeIdx;
                    const isCommit = i === committedModeIdx;
                    return (
                      <div key={m.key}
                        className={`cross-mode-cell ${isCenter ? 'cross-mode-cell-center' : ''} ${isCommit ? 'cross-mode-cell-commit' : ''}`}
                        style={{
                          transform: `translateY(${offset * MODE_H + modeWheel.dragOffset}px)`,
                          opacity: Math.abs(offset) === 0 ? 1 : Math.abs(offset) === 1 ? 0.4 : 0.15,
                        }}
                      >
                        <span className="cross-mode-label">{m.label}</span>
                        <span className="cross-mode-sub">{m.sub}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右侧 preset ledger */}
              <div className="cross-ledger-wrap">
                <div className="cross-ledger-head">
                  <span>name</span>
                  <span>kcal</span>
                  {view === 'macro' && <span>p · c · f</span>}
                </div>
                {committedMode === 'camera' ? (
                  <div className="cross-camera">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-text-3 mt-2">camera</p>
                  </div>
                ) : presetList.length === 0 ? (
                  <div className="cross-empty">
                    <p className="text-[13px] text-text-3 font-mono">no preset</p>
                    <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="cross-empty-cta">＋ new</button>
                  </div>
                ) : (
                  <div className="cross-ledger-body">
                    {/* 锁定行（中央 4 角标） */}
                    <span className="cross-row-lock-tl" aria-hidden />
                    <span className="cross-row-lock-tr" aria-hidden />
                    <span className="cross-row-lock-bl" aria-hidden />
                    <span className="cross-row-lock-br" aria-hidden />
                    <div className="cross-ledger-mask-t" aria-hidden />
                    <div className="cross-ledger-mask-b" aria-hidden />
                    <div className="cross-ledger-track"
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
                            className={`cross-row ${offset === 0 ? 'cross-row-active' : ''}`}
                            style={{
                              transform: `translateY(${offset * ROW_H + presetWheel.dragOffset}px)`,
                              opacity: dist === 0 ? 1 : dist === 1 ? 0.45 : 0.15,
                            }}
                          >
                            <span className="cross-row-name">{p.name}</span>
                            <span className="cross-row-kcal tabular">{Math.round(p.kcal)}</span>
                            {view === 'macro' && (
                              <span className="cross-row-macro tabular">
                                <span style={{ color: '#c8ff00' }}>{Math.round(p.protein_g)}</span>·
                                <span style={{ color: '#f5a623' }}>{Math.round(p.carb_g)}</span>·
                                <span style={{ color: '#a486f4' }}>{Math.round(p.fat_g)}</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 px-5 pt-2 pb-3">
              <button onClick={onRec} disabled={(committedMode !== 'camera' && !currentPreset) || api.recordingId != null} className="cross-rec">
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
@keyframes cross-corner-drift {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-1px, -1px); }
}

/* 按钮 = 偏心准星 */
.cross-knob {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 48px; height: 48px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 18px -4px rgba(0,0,0,0.7);
}
.cross-knob:active { transform: scale(0.92); }
.cross-knob > span {
  position: absolute;
  width: 8px; height: 8px;
}
.cross-tl, .cross-tr, .cross-bl, .cross-br {
  border-color: var(--color-accent);
  box-shadow: 0 0 4px rgba(200,255,0,0.5);
  animation: cross-corner-drift 2.4s ease-in-out infinite;
}
.cross-tl { top: 12px; left: 14px; border-top: 1.5px solid; border-left: 1.5px solid; }
.cross-tr { top: 12px; right: 14px; border-top: 1.5px solid; border-right: 1.5px solid; animation-delay: 0.6s; }
.cross-bl { bottom: 12px; left: 14px; border-bottom: 1.5px solid; border-left: 1.5px solid; animation-delay: 1.2s; }
.cross-br { bottom: 12px; right: 14px; border-bottom: 1.5px solid; border-right: 1.5px solid; animation-delay: 1.8s; }
.cross-tick {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%) rotate(45deg);
  width: 10px; height: 1.5px;
  background: var(--color-accent);
  box-shadow: 0 0 4px rgba(200,255,0,0.6);
  border-radius: 1px;
}

.cross-sheet {
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #161620 0%, #0e0e12 100%);
  border-top: 1px solid var(--color-accent);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
}
.cross-handle {
  width: 36px; height: 4px;
  background: var(--color-hairline-strong);
  border-radius: 999px;
  margin: 8px auto 4px;
}
.cross-icon-btn {
  width: 28px; height: 28px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 6px;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.cross-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }
.cross-toggle {
  background: transparent;
  border: 1px solid var(--color-hairline);
  border-radius: 6px;
  color: var(--color-text-3);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 6px 8px;
  cursor: pointer;
}
.cross-toggle:active { transform: scale(0.95); color: var(--color-accent); border-color: var(--color-accent); }

/* mode 区 + 锁定 4 角 */
.cross-mode-wrap {
  position: relative;
  height: 100%;
  border-right: 1px dashed var(--color-hairline);
  overflow: hidden;
}
.cross-lock-tl, .cross-lock-tr, .cross-lock-bl, .cross-lock-br {
  position: absolute;
  width: 14px; height: 14px;
  border: 0 solid var(--color-accent);
  z-index: 4;
  pointer-events: none;
  transition: transform 0.18s, opacity 0.18s;
  box-shadow: 0 0 6px rgba(200,255,0,0.5);
}
.cross-lock-tl { top: 50%; left: 0; margin-top: -28px; border-top-width: 1.5px; border-left-width: 1.5px; }
.cross-lock-tr { top: 50%; right: 0; margin-top: -28px; border-top-width: 1.5px; border-right-width: 1.5px; }
.cross-lock-bl { top: 50%; left: 0; margin-top: 14px; border-bottom-width: 1.5px; border-left-width: 1.5px; }
.cross-lock-br { top: 50%; right: 0; margin-top: 14px; border-bottom-width: 1.5px; border-right-width: 1.5px; }
.cross-lock-open { transform: translate(-2px, -2px); opacity: 0.6; }
.cross-lock-open.cross-lock-tr { transform: translate(2px, -2px); }
.cross-lock-open.cross-lock-bl { transform: translate(-2px, 2px); }
.cross-lock-open.cross-lock-br { transform: translate(2px, 2px); }

.cross-mode-mask-t, .cross-mode-mask-b {
  position: absolute; left: 0; right: 0;
  pointer-events: none; z-index: 2;
}
.cross-mode-mask-t { top: 0; height: 60px; background: linear-gradient(180deg, #161620 0%, transparent 100%); }
.cross-mode-mask-b { bottom: 0; height: 60px; background: linear-gradient(0deg, #161620 0%, transparent 100%); }
.cross-mode-track {
  position: absolute; inset: 0;
  cursor: grab;
}
.cross-mode-track:active { cursor: grabbing; }
.cross-mode-cell {
  position: absolute; left: 0; right: 0;
  top: 50%; margin-top: -${MODE_H / 2}px;
  height: ${MODE_H}px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  transition: opacity 0.18s;
}
.cross-mode-label {
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 17px; font-weight: 600;
  color: var(--color-text);
}
.cross-mode-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--color-text-3);
  margin-top: 2px;
}
.cross-mode-cell-center .cross-mode-label { font-size: 20px; }
.cross-mode-cell-commit .cross-mode-label { color: var(--color-accent); font-weight: 700; }
.cross-mode-cell-commit .cross-mode-sub { color: var(--color-accent); opacity: 0.7; }

/* ledger */
.cross-ledger-wrap {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cross-ledger-head {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  padding: 4px 12px 6px;
  border-bottom: 1px solid var(--color-hairline);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--color-text-3);
}
.cross-ledger-body {
  position: relative;
  flex: 1;
  overflow: hidden;
}
.cross-row-lock-tl, .cross-row-lock-tr, .cross-row-lock-bl, .cross-row-lock-br {
  position: absolute;
  width: 10px; height: 10px;
  border: 0 solid var(--color-accent);
  z-index: 4;
  pointer-events: none;
  box-shadow: 0 0 4px rgba(200,255,0,0.5);
}
.cross-row-lock-tl { top: 50%; left: 4px; margin-top: -${ROW_H / 2}px; border-top-width: 1.5px; border-left-width: 1.5px; }
.cross-row-lock-tr { top: 50%; right: 4px; margin-top: -${ROW_H / 2}px; border-top-width: 1.5px; border-right-width: 1.5px; }
.cross-row-lock-bl { top: 50%; left: 4px; margin-top: ${ROW_H / 2 - 10}px; border-bottom-width: 1.5px; border-left-width: 1.5px; }
.cross-row-lock-br { top: 50%; right: 4px; margin-top: ${ROW_H / 2 - 10}px; border-bottom-width: 1.5px; border-right-width: 1.5px; }
.cross-ledger-mask-t, .cross-ledger-mask-b {
  position: absolute; left: 0; right: 0;
  pointer-events: none; z-index: 2;
}
.cross-ledger-mask-t { top: 0; height: ${ROW_H * 2}px; background: linear-gradient(180deg, #161620 0%, transparent 100%); }
.cross-ledger-mask-b { bottom: 0; height: ${ROW_H * 2}px; background: linear-gradient(0deg, #161620 0%, transparent 100%); }
.cross-ledger-track {
  position: absolute; inset: 0;
  cursor: grab;
  z-index: 1;
}
.cross-ledger-track:active { cursor: grabbing; }
.cross-row {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ROW_H / 2}px;
  height: ${ROW_H}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 13px;
  color: var(--color-text);
  transition: opacity 0.18s, transform 0.18s;
}
.cross-row-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
}
.cross-row-kcal {
  font-size: 13px;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
}
.cross-row-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  margin-left: 10px;
  font-variant-numeric: tabular-nums;
}
.cross-row-active .cross-row-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-accent);
}
.cross-row-active .cross-row-kcal { font-size: 15px; color: var(--color-accent); }

.cross-camera, .cross-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-accent);
  gap: 8px;
}
.cross-empty-cta {
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

.cross-rec {
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
.cross-rec:active { transform: scale(0.98); }
.cross-rec:disabled { opacity: 0.4; }
`;
