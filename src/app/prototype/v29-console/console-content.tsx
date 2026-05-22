'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { useWheelPicker } from '../_lib/wheel-picker';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Industrial Twin LCD — 老式控制台风。
 * 入口：右下方形老式按键（凹陷动效 + 警示 LED）。
 * 展开：全屏控制面板：左小 LCD 显示 mode + 右大 LCD 显示 preset，
 *   底部红色 RECORD 大按键 + LED 亮起。
 * 美学：brushed metal + 铆钉 + 7-segment + 警示 LED + 工业警告条。
 */
const ITEM_HEIGHT = 50;
const VISIBLE_BEFORE = 2;
const VISIBLE_AFTER = 2;
const LONG_PRESS_MS = 450;

type Mode = 'recent' | 'menu' | 'camera';
const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: 'recent', label: 'CH.1', sub: 'RECENT' },
  { key: 'menu',   label: 'CH.2', sub: 'MENU' },
  { key: 'camera', label: 'CH.3', sub: 'CAMERA' },
];

export function ConsoleContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressedRec, setPressedRec] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const modeWheel = useWheelPicker(MODES.length, ITEM_HEIGHT);
  const currentMode = MODES[modeWheel.idx]!.key;

  const presetList = useMemo(() => {
    if (currentMode === 'recent') {
      return [...api.presets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
    }
    if (currentMode === 'menu') {
      return [...api.presets].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    }
    return [];
  }, [api.presets, currentMode]);

  const presetWheel = useWheelPicker(presetList.length, ITEM_HEIGHT);
  const currentPreset = presetList[presetWheel.idx];
  useEffect(() => { presetWheel.setIdx(0); }, [currentMode]); // eslint-disable-line

  function clearTimer() {
    if (longPressRef.current != null) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
  }
  function onRightPointerDown(e: React.PointerEvent) {
    presetWheel.pointerHandlers.onPointerDown(e);
    longPressFiredRef.current = false;
    clearTimer();
    if (currentMode === 'menu') {
      longPressRef.current = window.setTimeout(() => {
        longPressFiredRef.current = true;
        setMenuOpen(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      }, LONG_PRESS_MS);
    }
  }
  function onRightPointerMove(e: React.PointerEvent) {
    presetWheel.pointerHandlers.onPointerMove(e);
    if (Math.abs(presetWheel.dragOffset) > 6) clearTimer();
  }
  function onRightPointerUp(e: React.PointerEvent) {
    clearTimer();
    presetWheel.pointerHandlers.onPointerUp(e);
  }
  async function onRec() {
    setPressedRec(true);
    setTimeout(() => setPressedRec(false), 220);
    if (currentMode === 'camera') return;
    if (currentPreset) {
      const ok = await api.recordCustomPreset(currentPreset);
      if (ok) setOpen(false);
    }
  }

  return (
    <PrototypeShell title="2. Industrial Console">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口按键 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open console"
        className="console-knob z-[70]"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <span className="console-knob-led" aria-hidden />
        <span className="console-knob-label">PWR</span>
        <span className="console-knob-rivet console-knob-rivet-tl" aria-hidden />
        <span className="console-knob-rivet console-knob-rivet-tr" aria-hidden />
        <span className="console-knob-rivet console-knob-rivet-bl" aria-hidden />
        <span className="console-knob-rivet console-knob-rivet-br" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/95 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col console-stage"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
              animation: 'twin-in 0.3s var(--ease-out-soft) both',
            }}
          >
            {/* console title + warning stripe */}
            <div className="flex-shrink-0 px-4 pb-2">
              <div className="console-titlebar">
                <span className="console-rivet console-rivet-tl" aria-hidden />
                <span className="console-rivet console-rivet-tr" aria-hidden />
                <span className="console-titlebar-led" aria-hidden />
                <p className="console-titlebar-title">CONTROL PANEL · CH.{modeWheel.idx + 1}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="console-icon-btn" aria-label="new preset">＋</button>
                  <button onClick={() => setOpen(false)} className="console-close-btn">▣</button>
                </div>
              </div>
              <div className="console-warning-stripe" aria-hidden />
            </div>

            {/* twin LCD */}
            <div className="flex-1 px-4 min-h-0 relative">
              <div className="console-twin-rack">
                <span className="console-rivet console-rivet-tl" aria-hidden />
                <span className="console-rivet console-rivet-tr" aria-hidden />
                <span className="console-rivet console-rivet-bl" aria-hidden />
                <span className="console-rivet console-rivet-br" aria-hidden />

                {/* 左 LCD */}
                <div className="console-lcd console-lcd-left">
                  <div className="console-lcd-label">CHANNEL</div>
                  <div className="console-lcd-screen">
                    <div className="console-lcd-highlight" aria-hidden />
                    <div className="console-lcd-mask-top" aria-hidden />
                    <div className="console-lcd-mask-bot" aria-hidden />
                    <div
                      className="console-wheel"
                      {...modeWheel.pointerHandlers}
                      style={{ touchAction: 'none' }}
                    >
                      {Array.from({ length: VISIBLE_BEFORE + 1 + VISIBLE_AFTER }, (_, i) => {
                        const offset = i - VISIBLE_BEFORE;
                        const m = MODES[modeWheel.getOffsetIdx(offset)];
                        if (!m) return null;
                        const dist = Math.abs(offset);
                        const opacity = dist === 0 ? 1 : dist === 1 ? 0.4 : 0.12;
                        return (
                          <div
                            key={`${m.key}-${offset}`}
                            className={`console-row ${offset === 0 ? 'console-row-active' : ''}`}
                            style={{
                              transform: `translateY(${offset * ITEM_HEIGHT + modeWheel.dragOffset}px)`,
                              opacity,
                              height: ITEM_HEIGHT,
                            }}
                          >
                            <span className="console-mode-label">{m.label}</span>
                            <span className="console-mode-sub">{m.sub}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 右 LCD */}
                <div className="console-lcd console-lcd-right">
                  <div className="console-lcd-label">PRESET</div>
                  <div className="console-lcd-screen">
                    <div className="console-lcd-highlight" aria-hidden />
                    <div className="console-lcd-mask-top" aria-hidden />
                    <div className="console-lcd-mask-bot" aria-hidden />
                    {currentMode === 'camera' ? (
                      <div className="console-camera">
                        <p className="text-[10px] font-mono">[ CAM ]</p>
                        <p className="text-[18px] font-mono mt-1">◉ READY</p>
                        <p className="text-[9px] font-mono mt-3 opacity-50">PRESS RECORD TO SHOOT</p>
                      </div>
                    ) : presetList.length === 0 ? (
                      <div className="console-empty">
                        <p className="text-[10px] font-mono opacity-60">NO PRESET</p>
                        <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="console-empty-cta">＋ NEW</button>
                      </div>
                    ) : (
                      <div
                        className="console-wheel"
                        onPointerDown={onRightPointerDown}
                        onPointerMove={onRightPointerMove}
                        onPointerUp={onRightPointerUp}
                        onPointerCancel={(e) => { clearTimer(); presetWheel.pointerHandlers.onPointerCancel(e); }}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ touchAction: 'none' }}
                      >
                        {Array.from({ length: VISIBLE_BEFORE + 1 + VISIBLE_AFTER }, (_, i) => {
                          const offset = i - VISIBLE_BEFORE;
                          const p = presetList[presetWheel.getOffsetIdx(offset)];
                          if (!p) return null;
                          const dist = Math.abs(offset);
                          const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.15;
                          return (
                            <div
                              key={`${p.id}-${offset}`}
                              className={`console-row ${offset === 0 ? 'console-row-active' : ''}`}
                              style={{
                                transform: `translateY(${offset * ITEM_HEIGHT + presetWheel.dragOffset}px)`,
                                opacity,
                                height: ITEM_HEIGHT,
                              }}
                            >
                              <span className="console-preset-name">{p.name.toUpperCase().slice(0, 10)}</span>
                              <span className="console-preset-kcal tabular">{String(Math.round(p.kcal)).padStart(4, '0')}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* macro readout */}
            {currentPreset && currentMode !== 'camera' && (
              <p className="flex-shrink-0 px-5 text-center font-mono text-[10px] tabular mt-2 mb-1 tracking-[0.1em]">
                <span style={{ color: '#c8ff00' }}>P{String(Math.round(currentPreset.protein_g)).padStart(3, '0')}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#f5a623' }}>C{String(Math.round(currentPreset.carb_g)).padStart(3, '0')}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#a486f4' }}>F{String(Math.round(currentPreset.fat_g)).padStart(3, '0')}</span>
              </p>
            )}

            {/* record button */}
            <div className="flex-shrink-0 px-4 pt-1">
              <button
                onClick={onRec}
                disabled={(currentMode !== 'camera' && !currentPreset) || api.recordingId != null}
                className={`console-rec ${pressedRec ? 'console-rec-pressed' : ''}`}
              >
                <span className="console-rec-led" aria-hidden />
                <span className="console-rec-text">
                  {api.recordingId ? 'TRANSMITTING…' : currentMode === 'camera' ? '◉ SHOOT' : '◉ RECORD'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && currentPreset && currentMode === 'menu' && (
        <div className="fixed inset-0 z-[110]" onClick={() => setMenuOpen(false)} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[28%] bg-surface-2 border border-accent/40 rounded-xl overflow-hidden min-w-[240px] shadow-2xl shadow-black/60"
            style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-[14px] text-text font-medium font-mono uppercase">{currentPreset.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">{Math.round(currentPreset.kcal)}<span className="text-[9px] text-text-3 ml-0.5">KCAL</span></p>
            </div>
            <MenuItem icon="✎" onClick={() => { setMenuOpen(false); api.clearDuplicate(); setEditOpen(true); }}>EDIT</MenuItem>
            <MenuItem icon="⎘" onClick={async () => { setMenuOpen(false); api.clearDuplicate(); await api.addPreset(`${currentPreset.name} (copy)`, currentPreset.kcal); }}>DUPLICATE</MenuItem>
            <MenuItem icon="×" tone="danger" onClick={() => { setMenuOpen(false); setDelOpen(true); }}>DELETE</MenuItem>
            <MenuItem icon="◌" onClick={() => setMenuOpen(false)}>CANCEL</MenuItem>
          </div>
        </div>
      )}

      {createOpen && (
        <FormSheet title="＋ NEW PRESET" submitLabel="SAVE"
          onSubmit={async (n, k) => { const ok = await api.addPreset(n, k); if (ok) setCreateOpen(false); }}
          onCancel={() => setCreateOpen(false)} duplicateName={api.duplicateName}
        />
      )}
      {editOpen && currentPreset && (
        <FormSheet title={`✎ EDIT · ${currentPreset.name.toUpperCase()}`} submitLabel="SAVE"
          initial={{ name: currentPreset.name, kcal: currentPreset.kcal }}
          onSubmit={async (n, k) => { const ok = await api.updatePreset(currentPreset.id, n, k); if (ok) setEditOpen(false); }}
          onCancel={() => setEditOpen(false)} duplicateName={api.duplicateName}
        />
      )}

      <InlineConfirmDialog
        open={delOpen}
        title="DELETE THIS PRESET?"
        body={currentPreset ? <span className="font-mono">PERMANENTLY DELETE「<span className="text-text font-medium">{currentPreset.name.toUpperCase()}</span>」</span> : null}
        confirmText="DELETE"
        variant="danger"
        onCancel={() => setDelOpen(false)}
        onConfirm={async () => { if (currentPreset) await api.deletePreset(currentPreset.id); setDelOpen(false); }}
      />

      <style>{styles}</style>
    </PrototypeShell>
  );
}

function MenuItem({ children, onClick, icon, tone }: { children: React.ReactNode; onClick: () => void; icon: string; tone?: 'danger' }) {
  return (
    <button onClick={onClick} className="w-full px-4 py-3 text-left text-[12px] font-mono uppercase tracking-[0.1em] hover:bg-surface active:bg-surface border-b border-hairline last:border-b-0 flex items-center gap-3">
      <span className={`w-4 text-center ${tone === 'danger' ? 'text-danger' : 'text-text-3'}`}>{icon}</span>
      <span className={tone === 'danger' ? 'text-danger' : 'text-text'}>{children}</span>
    </button>
  );
}

function FormSheet({ title, submitLabel, initial, onSubmit, onCancel, duplicateName }: {
  title: string; submitLabel: string; initial?: { name: string; kcal: number };
  onSubmit: (n: string, k: number) => void | Promise<void>; onCancel: () => void; duplicateName?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-[420px] bg-surface-2 border-t border-accent/40 px-5 pt-5 rounded-t-xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
        <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">{title}</p>
        <MockPresetForm initial={initial} submitLabel={submitLabel} onSubmit={(n, k) => onSubmit(n, k)} onCancel={onCancel} />
        {duplicateName && <p className="text-[11px] text-danger mt-2 text-center">已存在同名 preset，請改名</p>}
      </div>
    </div>
  );
}

const styles = `
@keyframes twin-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
@keyframes console-led-blink {
  0%, 60%, 100% { background: var(--color-accent); box-shadow: 0 0 6px rgba(200,255,0,0.6); }
  65%, 70%      { background: #444; box-shadow: none; }
}
@keyframes console-warning-stripe-scroll {
  from { background-position: 0 0; }
  to   { background-position: 24px 0; }
}

/* 入口按键 */
.console-knob {
  width: 52px;
  height: 52px;
  background:
    linear-gradient(135deg, #3a3a44 0%, #1a1a1f 60%, #0a0a0c 100%);
  border: 1.5px solid #555;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  padding: 0;
  box-shadow:
    0 8px 18px -4px rgba(0,0,0,0.8),
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 -2px 4px rgba(0,0,0,0.5) inset;
  transition: transform 0.1s, box-shadow 0.1s;
}
.console-knob:active {
  transform: scale(0.96) translateY(2px);
  box-shadow:
    0 4px 8px -2px rgba(0,0,0,0.7),
    0 -1px 2px rgba(0,0,0,0.4) inset;
}
.console-knob-led {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: console-led-blink 2.4s ease-in-out infinite;
}
.console-knob-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  color: var(--color-accent);
  letter-spacing: 0.15em;
}
.console-knob-rivet {
  position: absolute;
  width: 3px; height: 3px;
  background: radial-gradient(circle at 30% 25%, #888 0%, #2a2a32 60%);
  border-radius: 50%;
}
.console-knob-rivet-tl { top: 4px; left: 4px; }
.console-knob-rivet-tr { top: 4px; right: 4px; }
.console-knob-rivet-bl { bottom: 4px; left: 4px; }
.console-knob-rivet-br { bottom: 4px; right: 4px; }

/* stage */
.console-stage {
  background:
    repeating-linear-gradient(90deg, #15151a 0px, #15151a 1px, #1a1a1f 1px, #1a1a1f 2px),
    #15151a;
}

/* titlebar */
.console-titlebar {
  position: relative;
  background:
    linear-gradient(180deg, #2a2a32 0%, #1a1a1f 100%);
  border: 1px solid #3a3a44;
  border-radius: 4px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow:
    0 2px 4px rgba(0,0,0,0.3),
    0 1px 0 rgba(255,255,255,0.06) inset;
}
.console-titlebar-led {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: console-led-blink 1.8s ease-in-out infinite;
  margin-right: 8px;
  box-shadow: 0 0 6px rgba(200,255,0,0.6);
}
.console-titlebar-title {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.18em;
}
.console-rivet {
  position: absolute;
  width: 5px; height: 5px;
  background: radial-gradient(circle at 30% 25%, #777 0%, #2a2a32 60%);
  border-radius: 50%;
  box-shadow: 0 1px 1px rgba(0,0,0,0.6);
}
.console-rivet-tl { top: 4px; left: 4px; }
.console-rivet-tr { top: 4px; right: 4px; }
.console-rivet-bl { bottom: 4px; left: 4px; }
.console-rivet-br { bottom: 4px; right: 4px; }

.console-icon-btn {
  width: 26px; height: 26px;
  background: #0a0a0c;
  border: 1px solid var(--color-accent);
  border-radius: 3px;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.console-icon-btn:active { transform: scale(0.92); }
.console-close-btn {
  background: transparent;
  border: 1px solid var(--color-hairline);
  color: var(--color-text-3);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 3px;
  cursor: pointer;
}
.console-close-btn:active { transform: scale(0.92); }

.console-warning-stripe {
  height: 6px;
  background-image: repeating-linear-gradient(45deg, #c8ff00 0px, #c8ff00 8px, #0a0a0c 8px, #0a0a0c 16px);
  border-left: 1px solid #3a3a44;
  border-right: 1px solid #3a3a44;
  animation: console-warning-stripe-scroll 1.6s linear infinite;
  margin-top: 4px;
  opacity: 0.7;
}

/* twin rack */
.console-twin-rack {
  position: relative;
  height: 100%;
  display: grid;
  grid-template-columns: 38% 62%;
  gap: 8px;
  background:
    linear-gradient(180deg, #1a1a1f 0%, #0e0e12 100%);
  border: 1px solid #3a3a44;
  border-radius: 6px;
  padding: 14px 12px;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 8px 20px -6px rgba(0,0,0,0.5);
}

/* LCD */
.console-lcd {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.console-lcd-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--color-text-3);
  margin-bottom: 4px;
  padding-left: 2px;
}
.console-lcd-screen {
  position: relative;
  flex: 1;
  background:
    radial-gradient(ellipse at 50% 50%, rgba(200, 255, 0, 0.06) 0%, transparent 70%),
    linear-gradient(180deg, #0a0c08 0%, #06080a 100%);
  border: 1px solid #2a2a32;
  border-radius: 4px;
  overflow: hidden;
  box-shadow:
    0 0 0 2px #15151a inset,
    0 0 0 3px #2a2a32 inset,
    0 2px 4px rgba(0,0,0,0.6) inset;
}
.console-lcd-highlight {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: ${ITEM_HEIGHT}px;
  border-top: 1px solid rgba(200,255,0,0.5);
  border-bottom: 1px solid rgba(200,255,0,0.5);
  background: rgba(200, 255, 0, 0.06);
  pointer-events: none;
  z-index: 2;
}
.console-lcd-mask-top {
  position: absolute;
  left: 0; right: 0;
  top: 0;
  height: ${ITEM_HEIGHT * VISIBLE_BEFORE}px;
  background: linear-gradient(180deg, #06080a 0%, rgba(6,8,10,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.console-lcd-mask-bot {
  position: absolute;
  left: 0; right: 0;
  bottom: 0;
  height: ${ITEM_HEIGHT * VISIBLE_AFTER}px;
  background: linear-gradient(0deg, #06080a 0%, rgba(6,8,10,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.console-wheel {
  position: absolute;
  inset: 0;
  cursor: grab;
  z-index: 1;
}
.console-wheel:active { cursor: grabbing; }

.console-row {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(200,255,0,0.85);
  text-shadow: 0 0 4px rgba(200,255,0,0.4);
  transition: opacity 0.18s;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
}
.console-row-active {
  text-shadow: 0 0 10px rgba(200,255,0,0.7);
}
.console-mode-label {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.16em;
}
.console-mode-sub {
  font-size: 8.5px;
  letter-spacing: 0.18em;
  opacity: 0.7;
}
.console-row-active .console-mode-label { font-size: 20px; color: var(--color-accent); }
.console-row-active .console-mode-sub { opacity: 0.9; color: var(--color-accent); }

.console-lcd-right .console-row {
  flex-direction: row;
  justify-content: space-between;
  padding: 0 12px;
  gap: 6px;
}
.console-preset-name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.console-preset-kcal {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.console-row-active .console-preset-name { font-size: 18px; color: var(--color-accent); }
.console-row-active .console-preset-kcal { font-size: 16px; color: var(--color-accent); }

.console-camera, .console-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  text-shadow: 0 0 8px rgba(200,255,0,0.5);
  z-index: 4;
  gap: 4px;
}
.console-empty-cta {
  margin-top: 6px;
  background: #0a0a0c;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  padding: 6px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  cursor: pointer;
  border-radius: 3px;
}

/* record button */
.console-rec {
  position: relative;
  width: 100%;
  background:
    linear-gradient(180deg, #aa1f1f 0%, #6a0a0a 100%);
  color: #ffe;
  border: 1.5px solid #d33;
  border-radius: 8px;
  padding: 18px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.22em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow:
    0 6px 0 #4a0606,
    0 8px 18px -4px rgba(0,0,0,0.7),
    0 1px 0 rgba(255,255,255,0.15) inset;
  transition: transform 0.1s, box-shadow 0.1s;
}
.console-rec-pressed, .console-rec:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 #4a0606,
    0 4px 10px -2px rgba(0,0,0,0.5),
    0 -1px 1px rgba(0,0,0,0.2) inset;
}
.console-rec:disabled { opacity: 0.5; cursor: not-allowed; }
.console-rec-led {
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #ff4040;
  box-shadow:
    0 0 0 2px #2a0a0a inset,
    0 0 8px rgba(255,80,80,0.8);
  animation: console-led-blink 1.2s ease-in-out infinite;
}
.console-rec-text {
  font-size: 14px;
}
`;
