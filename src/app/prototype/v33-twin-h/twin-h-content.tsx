'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { useDelayedCommit } from '../_lib/use-delayed-commit';
import { useHWheelPicker, PresetCrudModals, MODES, presetListForMode } from '../_lib/picker-shared';
import type { HomeSnapshot } from '@/lib/home-snapshot';

const CARD_W = 200;
const LONG_PRESS_MS = 450;
const COMMIT_DELAY = 1200;

export function TwinHContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);

  const [exploreModeIdx, setExploreModeIdx] = useState(0);
  const committedModeIdx = useDelayedCommit(exploreModeIdx, COMMIT_DELAY);
  const committedMode = MODES[committedModeIdx]!.key;

  const presetList = useMemo(() => presetListForMode(api.presets, committedMode), [api.presets, committedMode]);
  const presetWheel = useHWheelPicker(presetList.length, CARD_W);
  const currentPreset = presetList[presetWheel.idx];
  const canLongPress = committedMode !== 'camera' && currentPreset != null;

  function pickMode(i: number) {
    setExploreModeIdx(i);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(6); } catch {}
    }
  }

  function clearTimer() { if (longPressRef.current != null) { window.clearTimeout(longPressRef.current); longPressRef.current = null; } }
  function onPresetPointerDown(e: React.PointerEvent) {
    presetWheel.pointerHandlers.onPointerDown(e);
    clearTimer();
    if (canLongPress && !presetWheel.isAnimating && Math.abs(presetWheel.dragOffsetRef.current) <= 6) {
      longPressRef.current = window.setTimeout(() => {
        setMenuOpen(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      }, LONG_PRESS_MS);
    }
  }
  function onPresetPointerMove(e: React.PointerEvent) {
    presetWheel.pointerHandlers.onPointerMove(e);
    if (Math.abs(presetWheel.dragOffsetRef.current) > 6) clearTimer();
  }
  function onPresetPointerUp(e: React.PointerEvent) { clearTimer(); presetWheel.pointerHandlers.onPointerUp(e); }
  async function onRec() {
    if (committedMode === 'camera') return;
    if (currentPreset) { const ok = await api.recordCustomPreset(currentPreset); if (ok) setOpen(false); }
  }

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
            <div className="twh-handle" />
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[18px] leading-none mt-0.5">twin h</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="twh-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            {/* mode tabs（点击切换 + 1.2s 后实际提交） */}
            <div className="flex-shrink-0 twh-tabs">
              {MODES.map((m, i) => {
                const isExplore = i === exploreModeIdx;
                const isCommit = i === committedModeIdx;
                return (
                  <button key={m.key}
                    onClick={() => pickMode(i)}
                    className={`twh-tab ${isExplore ? 'twh-tab-explore' : ''} ${isCommit ? 'twh-tab-commit' : ''}`}
                    aria-pressed={isExplore}
                  >
                    <span className="twh-tab-label">{m.label}</span>
                    <span className="twh-tab-sub">{m.sub}</span>
                  </button>
                );
              })}
            </div>

            {/* preset cover-flow */}
            <div className="flex-1 twh-cover-wrap min-h-0 relative">
              {committedMode === 'camera' ? (
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
                  <div className="twh-cover-track"
                    onPointerDown={onPresetPointerDown}
                    onPointerMove={onPresetPointerMove}
                    onPointerUp={onPresetPointerUp}
                    onPointerCancel={(e) => { clearTimer(); presetWheel.pointerHandlers.onPointerCancel(e); }}
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
                      return (
                        <div key={`${p.id}-${rel}`}
                          className={`twh-card ${isCenter ? 'twh-card-active' : ''}`}
                          style={{
                            transform: `translateX(${visualPos}px) scale(${scale})`,
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
                  {canLongPress && (
                    <p className="twh-hint">長按 編輯／刪除</p>
                  )}
                </>
              )}
            </div>

            <div className="flex-shrink-0 px-5 pb-3">
              <button onClick={onRec} disabled={(committedMode !== 'camera' && !currentPreset) || api.recordingId != null} className="twh-rec">
                {api.recordingId ? 'recording…' : committedMode === 'camera' ? '📷 拍照' : '● 記錄這一筆'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PresetCrudModals
        api={api} currentPreset={currentPreset}
        menuOpen={menuOpen && canLongPress} setMenuOpen={setMenuOpen}
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
@keyframes twh-dot-slide {
  0%, 100% { transform: translate(-50%, -50%) translateX(-6px); }
  50% { transform: translate(-50%, -50%) translateX(6px); }
}

/* 按钮 = 横向刻度 + 居中圆点 */
.twh-knob {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 48px; height: 48px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 18px -4px rgba(0,0,0,0.7);
}
.twh-knob:active { transform: scale(0.92); }
.twh-knob-rule {
  display: block;
  width: 28px; height: 2px;
  background: var(--color-accent);
  opacity: 0.6;
  border-radius: 999px;
  background-image: repeating-linear-gradient(90deg, var(--color-accent) 0 2px, transparent 2px 6px);
  background-size: 6px 2px;
  background-clip: content-box;
}
.twh-knob-dot {
  position: absolute;
  top: 50%; left: 50%;
  width: 6px; height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(200,255,0,0.7);
  animation: twh-dot-slide 2.6s ease-in-out infinite;
}

.twh-sheet {
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #161620 0%, #0e0e12 100%);
  border-top: 1px solid var(--color-accent);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
}
.twh-handle {
  width: 36px; height: 4px;
  background: var(--color-hairline-strong);
  border-radius: 999px;
  margin: 8px auto 4px;
}
.twh-icon-btn {
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
.twh-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }

/* mode tabs */
.twh-tabs {
  display: flex;
  gap: 8px;
  padding: 4px 16px 10px;
}
.twh-tab {
  flex: 1;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 12px;
  padding: 8px 4px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  color: var(--color-text-2);
  cursor: pointer;
  display: flex; flex-direction: column;
  align-items: center; gap: 2px;
  transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.12s;
}
.twh-tab:active { transform: scale(0.95); }
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
  opacity: 0.55;
  line-height: 1;
}
/* explore（点了但 1.2s 还没提交）：lime 虚框 + 微底色 */
.twh-tab-explore {
  border-color: var(--color-accent);
  border-style: dashed;
  background: rgba(200,255,0,0.06);
  color: var(--color-accent);
}
.twh-tab-explore .twh-tab-sub { opacity: 0.75; }
/* commit：实色 lime 填充 */
.twh-tab-commit {
  border-style: solid;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border-color: var(--color-accent);
  box-shadow: 0 4px 12px -2px rgba(200,255,0,0.3);
}
.twh-tab-commit .twh-tab-sub { opacity: 0.8; }

/* preset cover flow */
.twh-cover-wrap {
  position: relative;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.twh-cover-mask-l, .twh-cover-mask-r {
  position: absolute; top: 0; bottom: 0; width: 80px;
  pointer-events: none; z-index: 3;
}
.twh-cover-mask-l { left: 0; background: linear-gradient(90deg, #0e0e12 0%, rgba(14,14,18,0.6) 60%, transparent 100%); }
.twh-cover-mask-r { right: 0; background: linear-gradient(-90deg, #0e0e12 0%, rgba(14,14,18,0.6) 60%, transparent 100%); }
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
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 14px;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  padding: 10px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  will-change: transform, opacity;
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
  background: linear-gradient(180deg, rgba(28,28,34,0.95) 0%, rgba(20,20,26,1) 100%);
  border-color: var(--color-accent);
  box-shadow: 0 12px 28px -10px rgba(0,0,0,0.7), 0 0 22px rgba(200,255,0,0.14);
}
.twh-card-active .twh-card-name { color: var(--color-accent); font-size: 18px; }
.twh-card-active .twh-card-kcal { color: var(--color-accent); font-size: 24px; }

.twh-hint {
  position: absolute; left: 50%; bottom: 4px;
  transform: translateX(-50%);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--color-text-4);
  text-transform: uppercase;
  pointer-events: none;
  z-index: 4;
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
  border-radius: 8px;
  padding: 10px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.14em;
  cursor: pointer;
}

.twh-rec {
  width: 100%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 12px;
  padding: 13px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  box-shadow: 0 8px 20px -6px rgba(200,255,0,0.4);
}
.twh-rec:active { transform: scale(0.98); }
.twh-rec:disabled { opacity: 0.4; }
`;
