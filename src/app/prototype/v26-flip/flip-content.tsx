'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { useWheelPicker } from '../_lib/wheel-picker';
import type { HomeSnapshot } from '@/lib/home-snapshot';

/**
 * Split-Flap 機械翻頁板 — 主页保留。
 * 入口：右下方形按鈕（小翻頁卡片，每 4s 翻一次）。
 * 展開：機場航班翻頁板，每行 = 一張黑底翻牌，dot matrix 字體 uppercase。
 * 中央高亮一行 lime border，首尾循環，CRUD 同 picker（tap = 記錄 / 長按 = 編輯）。
 */
const ITEM_HEIGHT = 52;
const VISIBLE_BEFORE = 3;
const VISIBLE_AFTER = 3;
const LONG_PRESS_MS = 450;

export function FlipContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const presets = useMemo(() => {
    return [...api.presets].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [api.presets]);

  const wheel = useWheelPicker(presets.length, ITEM_HEIGHT);
  const current = presets[wheel.idx];

  function clearTimer() {
    if (longPressRef.current != null) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
  }
  function onCenterPointerDown(e: React.PointerEvent) {
    wheel.pointerHandlers.onPointerDown(e);
    longPressFiredRef.current = false;
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setMenuOpen(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, LONG_PRESS_MS);
  }
  function onCenterPointerMove(e: React.PointerEvent) {
    wheel.pointerHandlers.onPointerMove(e);
    if (Math.abs(wheel.dragOffset) > 6) clearTimer();
  }
  function onCenterPointerUp(e: React.PointerEvent) {
    clearTimer();
    wheel.pointerHandlers.onPointerUp(e);
  }
  async function recordCurrent() {
    if (!current) return;
    const ok = await api.recordCustomPreset(current);
    if (ok) setOpen(false);
  }

  return (
    <PrototypeShell title="2. Split Flap">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：方形翻页卡按钮 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open flip board"
        className="fixed right-5 z-[70] flip-knob"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <span className="flip-knob-card flip-knob-top">
          <span className="flip-knob-letter">F</span>
        </span>
        <span className="flip-knob-seam" aria-hidden />
        <span className="flip-knob-card flip-knob-bot">
          <span className="flip-knob-letter">F</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/95 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col flip-stage"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
              animation: 'picker-in 0.3s var(--ease-out-soft) both',
            }}
          >
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pb-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-mono">flip board</p>
                <p className="text-[10px] font-mono text-text-3 mt-0.5">
                  {presets.length} preset · drag · tap = log · hold = edit
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="flip-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            {/* flip board */}
            <div className="flex-1 flex flex-col items-center justify-center px-5 min-h-0">
              {presets.length === 0 ? (
                <div className="text-center">
                  <p className="text-[14px] text-text-3 font-mono mb-4">no preset</p>
                  <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="flip-create-cta">＋ NEW</button>
                </div>
              ) : (
                <div className="flip-board-wrap">
                  {/* 铆钉 */}
                  <span className="flip-rivet flip-rivet-tl" aria-hidden />
                  <span className="flip-rivet flip-rivet-tr" aria-hidden />
                  <span className="flip-rivet flip-rivet-bl" aria-hidden />
                  <span className="flip-rivet flip-rivet-br" aria-hidden />
                  {/* 中央高亮 */}
                  <div className="flip-highlight" aria-hidden />
                  {/* mask */}
                  <div className="flip-mask-top" aria-hidden />
                  <div className="flip-mask-bot" aria-hidden />
                  {/* board */}
                  <div
                    className="flip-board"
                    onPointerDown={onCenterPointerDown}
                    onPointerMove={onCenterPointerMove}
                    onPointerUp={onCenterPointerUp}
                    onPointerCancel={(e) => { clearTimer(); wheel.pointerHandlers.onPointerCancel(e); }}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ touchAction: 'none' }}
                  >
                    {Array.from({ length: VISIBLE_BEFORE + 1 + VISIBLE_AFTER }, (_, i) => {
                      const offset = i - VISIBLE_BEFORE;
                      const p = presets[wheel.getOffsetIdx(offset)];
                      if (!p) return null;
                      const dist = Math.abs(offset);
                      const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.22 : 0.08;
                      return (
                        <div
                          key={`${p.id}-${offset}`}
                          className={`flip-row ${offset === 0 ? 'flip-row-active' : ''}`}
                          style={{
                            transform: `translateY(${offset * ITEM_HEIGHT + wheel.dragOffset}px)`,
                            opacity,
                            height: ITEM_HEIGHT,
                          }}
                        >
                          <div className="flip-card-top">
                            <span className="flip-name">{p.name.toUpperCase().slice(0, 14)}</span>
                            <span className="flip-kcal tabular">{String(Math.round(p.kcal)).padStart(4, '0')}</span>
                          </div>
                          <div className="flip-seam" aria-hidden />
                          <div className="flip-card-bot">
                            <span className="flip-name">{p.name.toUpperCase().slice(0, 14)}</span>
                            <span className="flip-kcal tabular">{String(Math.round(p.kcal)).padStart(4, '0')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* macro + record */}
            {current && (
              <div className="flex-shrink-0 px-5 pb-1">
                <p className="flip-macro tabular">
                  <span style={{ color: '#c8ff00' }}>P {Math.round(current.protein_g)}</span>
                  <span className="opacity-50 mx-2">·</span>
                  <span style={{ color: '#f5a623' }}>C {Math.round(current.carb_g)}</span>
                  <span className="opacity-50 mx-2">·</span>
                  <span style={{ color: '#a486f4' }}>F {Math.round(current.fat_g)}</span>
                </p>
                <button onClick={recordCurrent} disabled={api.recordingId != null} className="flip-rec">
                  {api.recordingId ? 'RECORDING…' : '▼ PRESS TO LOG'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {menuOpen && current && (
        <div className="fixed inset-0 z-[110]" onClick={() => setMenuOpen(false)} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-[28%] bg-surface-2 border border-accent/40 rounded-xl overflow-hidden min-w-[240px] shadow-2xl shadow-black/60"
            style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-[14px] text-text font-medium font-mono uppercase">{current.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">{Math.round(current.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
            </div>
            <MenuItem icon="✎" onClick={() => { setMenuOpen(false); api.clearDuplicate(); setEditOpen(true); }}>EDIT</MenuItem>
            <MenuItem icon="⎘" onClick={async () => { setMenuOpen(false); api.clearDuplicate(); await api.addPreset(`${current.name} (copy)`, current.kcal); }}>DUPLICATE</MenuItem>
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
      {editOpen && current && (
        <FormSheet title={`✎ EDIT · ${current.name.toUpperCase()}`} submitLabel="SAVE"
          initial={{ name: current.name, kcal: current.kcal }}
          onSubmit={async (n, k) => { const ok = await api.updatePreset(current.id, n, k); if (ok) setEditOpen(false); }}
          onCancel={() => setEditOpen(false)} duplicateName={api.duplicateName}
        />
      )}

      <InlineConfirmDialog
        open={delOpen}
        title="DELETE THIS PRESET?"
        body={current ? <span className="font-mono">PERMANENTLY REMOVE「<span className="text-text font-medium">{current.name.toUpperCase()}</span>」</span> : null}
        confirmText="DELETE"
        variant="danger"
        onCancel={() => setDelOpen(false)}
        onConfirm={async () => { if (current) await api.deletePreset(current.id); setDelOpen(false); }}
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
@keyframes picker-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
@keyframes flip-knob-flip {
  0%, 70%, 100% { transform: rotateX(0deg); }
  85% { transform: rotateX(-90deg); }
  90% { transform: rotateX(-180deg); }
  95% { transform: rotateX(-90deg); }
}

/* 入口翻页卡按钮 */
.flip-knob {
  width: 44px;
  height: 44px;
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  padding: 0;
  cursor: pointer;
  position: fixed;
  perspective: 200px;
}
.flip-knob:active { transform: scale(0.92); }
.flip-knob-card {
  flex: 1;
  background: #0a0a0c;
  border: 1.5px solid var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 14px;
  color: var(--color-accent);
}
.flip-knob-top {
  border-radius: 4px 4px 0 0;
  border-bottom: none;
  align-items: flex-end;
  height: 50%;
  overflow: hidden;
  transform-origin: bottom center;
  animation: flip-knob-flip 4.2s ease-in-out infinite;
}
.flip-knob-top .flip-knob-letter {
  transform: translateY(50%);
}
.flip-knob-bot {
  border-radius: 0 0 4px 4px;
  border-top: none;
  align-items: flex-start;
  height: 50%;
  overflow: hidden;
}
.flip-knob-bot .flip-knob-letter {
  transform: translateY(-50%);
}
.flip-knob-seam {
  display: block;
  height: 1px;
  background: rgba(200,255,0,0.4);
  margin: -0.5px 1px;
  z-index: 2;
  position: relative;
}

/* stage */
.flip-stage {
  background: linear-gradient(180deg, #0a0e0a 0%, #0a0a0c 100%);
  background-image:
    repeating-linear-gradient(0deg, transparent 0, transparent 23px, rgba(200,255,0,0.02) 23px, rgba(200,255,0,0.02) 24px);
}

.flip-icon-btn {
  width: 32px; height: 32px;
  background: #0a0a0c;
  border: 1.5px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.flip-icon-btn:active { transform: scale(0.92); }

/* board */
.flip-board-wrap {
  position: relative;
  width: 100%;
  max-width: 360px;
  height: ${ITEM_HEIGHT * (VISIBLE_BEFORE + 1 + VISIBLE_AFTER)}px;
  background: #050505;
  border: 2px solid #1a1a1f;
  border-radius: 10px;
  padding: 12px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(200,255,0,0.06) inset,
    0 30px 60px -16px rgba(0,0,0,0.8);
}
.flip-rivet {
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, #444 0%, #1a1a1f 60%);
  box-shadow: 0 1px 1px rgba(0,0,0,0.5);
}
.flip-rivet-tl { top: 4px; left: 4px; }
.flip-rivet-tr { top: 4px; right: 4px; }
.flip-rivet-bl { bottom: 4px; left: 4px; }
.flip-rivet-br { bottom: 4px; right: 4px; }

.flip-highlight {
  position: absolute;
  left: 12px; right: 12px;
  top: 50%;
  transform: translateY(-50%);
  height: ${ITEM_HEIGHT}px;
  border: 1.5px solid var(--color-accent);
  border-radius: 4px;
  box-shadow:
    0 0 0 4px rgba(200,255,0,0.12),
    0 0 24px rgba(200,255,0,0.18);
  pointer-events: none;
  z-index: 2;
}
.flip-mask-top {
  position: absolute;
  left: 12px; right: 12px;
  top: 12px;
  height: ${ITEM_HEIGHT * VISIBLE_BEFORE}px;
  background: linear-gradient(180deg, #050505 0%, rgba(5,5,5,0.7) 50%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.flip-mask-bot {
  position: absolute;
  left: 12px; right: 12px;
  bottom: 12px;
  height: ${ITEM_HEIGHT * VISIBLE_AFTER}px;
  background: linear-gradient(0deg, #050505 0%, rgba(5,5,5,0.7) 50%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.flip-board {
  position: absolute;
  inset: 12px;
  cursor: grab;
  z-index: 1;
}
.flip-board:active { cursor: grabbing; }

.flip-row {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  flex-direction: column;
  transition: opacity 0.18s;
}
.flip-card-top, .flip-card-bot {
  flex: 1;
  background: #0a0a0c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 700;
  color: #d9d9d9;
  letter-spacing: 0.06em;
  overflow: hidden;
  border: 1px solid #1a1a1f;
}
.flip-card-top { border-radius: 4px 4px 0 0; align-items: flex-end; padding-bottom: 1px; border-bottom: none; }
.flip-card-bot { border-radius: 0 0 4px 4px; align-items: flex-start; padding-top: 1px; border-top: none; }
.flip-card-top span, .flip-card-bot span {
  transform: translateY(50%);
}
.flip-card-bot span {
  transform: translateY(-50%);
}
.flip-seam {
  height: 1px;
  background: linear-gradient(to right, transparent, #050505 20%, #050505 80%, transparent);
  margin: 0 -1px;
  position: relative;
  z-index: 4;
}

.flip-row-active .flip-card-top,
.flip-row-active .flip-card-bot {
  color: var(--color-accent);
  background: #000;
  border-color: var(--color-accent);
  font-size: 20px;
  text-shadow: 0 0 8px rgba(200,255,0,0.4);
}

.flip-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.flip-kcal {
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 600;
  margin-left: 10px;
  opacity: 0.75;
}
.flip-row-active .flip-kcal { opacity: 1; font-size: 16px; }

.flip-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-align: center;
  letter-spacing: 0.06em;
  padding: 8px 0 12px;
  border-top: 1px dashed var(--color-hairline);
  margin-top: 4px;
}
.flip-rec {
  width: 100%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 6px;
  padding: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2em;
  cursor: pointer;
  transition: transform 0.14s;
  box-shadow: 0 8px 20px -6px rgba(200,255,0,0.4);
}
.flip-rec:active { transform: scale(0.98); }
.flip-rec:disabled { opacity: 0.5; }
.flip-create-cta {
  background: #0a0a0c;
  color: var(--color-accent);
  border: 1.5px solid var(--color-accent);
  border-radius: 6px;
  padding: 12px 24px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.16em;
  cursor: pointer;
}
.flip-create-cta:active { transform: scale(0.96); }
`;
