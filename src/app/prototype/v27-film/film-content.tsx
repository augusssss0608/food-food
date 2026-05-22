'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { useWheelPicker } from '../_lib/wheel-picker';
import type { HomeSnapshot } from '@/lib/home-snapshot';

/**
 * 35mm Film Strip 膠卷 — 主页保留。
 * 入口：右下圓形按鈕（齒輪 / 胶卷胶片样式 + 摇曳动效）。
 * 展開：垂直 35mm 膠卷滾動。每幀 = 一個 preset，兩側有膠卷齒孔同步移動。
 * 中央高亮幀 lime border + lime caption，首尾循環，CRUD 同上。
 */
const ITEM_HEIGHT = 58;
const VISIBLE_BEFORE = 3;
const VISIBLE_AFTER = 3;
const LONG_PRESS_MS = 450;

export function FilmContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
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
    <PrototypeShell title="3. 35mm Film">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：胶卷小盘按钮 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open film reel"
        className="fixed right-5 z-[70] film-knob"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <span className="film-knob-reel" aria-hidden>
          <span className="film-knob-hole" />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/92 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col film-stage"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
              animation: 'picker-in 0.3s var(--ease-out-soft) both',
            }}
          >
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pb-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-mono">35mm reel</p>
                <p className="text-[10px] font-mono text-text-3 mt-0.5">
                  {presets.length} frames · drag · tap = log · hold = edit
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="film-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            {/* film strip */}
            <div className="flex-1 flex flex-col items-center justify-center px-5 min-h-0">
              {presets.length === 0 ? (
                <div className="text-center">
                  <p className="text-[14px] text-text-3 font-mono mb-4">no frames</p>
                  <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="film-create-cta">＋ FIRST FRAME</button>
                </div>
              ) : (
                <div className="film-strip-wrap">
                  {/* 中央取景框 */}
                  <div className="film-highlight" aria-hidden />
                  {/* fade mask */}
                  <div className="film-mask-top" aria-hidden />
                  <div className="film-mask-bot" aria-hidden />
                  {/* film strip */}
                  <div
                    className="film-strip"
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
                      const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.28 : 0.1;
                      const realIdx = wheel.getOffsetIdx(offset) + 1;
                      return (
                        <div
                          key={`${p.id}-${offset}`}
                          className={`film-frame ${offset === 0 ? 'film-frame-active' : ''}`}
                          style={{
                            transform: `translateY(${offset * ITEM_HEIGHT + wheel.dragOffset}px)`,
                            opacity,
                            height: ITEM_HEIGHT,
                          }}
                        >
                          <div className="film-frame-image">
                            <span className="film-frame-num tabular">FR.{String(realIdx).padStart(3, '0')}</span>
                            <span className="film-frame-name">{p.name}</span>
                            <span className="film-frame-kcal tabular">{Math.round(p.kcal)} kcal</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* 两侧 perforation holes (固定位置不动) */}
                  <PerforationColumn side="left" totalRows={VISIBLE_BEFORE + 1 + VISIBLE_AFTER} dragOffset={wheel.dragOffset} />
                  <PerforationColumn side="right" totalRows={VISIBLE_BEFORE + 1 + VISIBLE_AFTER} dragOffset={wheel.dragOffset} />
                </div>
              )}
            </div>

            {/* macro + record */}
            {current && (
              <div className="flex-shrink-0 px-5 pb-1">
                <p className="film-macro tabular">
                  <span style={{ color: '#c8ff00' }}>P {Math.round(current.protein_g)}</span>
                  <span className="opacity-50 mx-2">·</span>
                  <span style={{ color: '#f5a623' }}>C {Math.round(current.carb_g)}</span>
                  <span className="opacity-50 mx-2">·</span>
                  <span style={{ color: '#a486f4' }}>F {Math.round(current.fat_g)}</span>
                </p>
                <button onClick={recordCurrent} disabled={api.recordingId != null} className="film-rec">
                  {api.recordingId ? 'EXPOSING…' : '◉ EXPOSE THIS FRAME'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {menuOpen && current && (
        <div className="fixed inset-0 z-[110]" onClick={() => setMenuOpen(false)} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[28%] bg-surface-2 border border-accent/40 rounded-xl overflow-hidden min-w-[240px] shadow-2xl shadow-black/60"
            style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-[14px] text-text font-medium">{current.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">{Math.round(current.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
            </div>
            <MenuItem icon="✎" onClick={() => { setMenuOpen(false); api.clearDuplicate(); setEditOpen(true); }}>編輯這張底片</MenuItem>
            <MenuItem icon="⎘" onClick={async () => { setMenuOpen(false); api.clearDuplicate(); await api.addPreset(`${current.name} (copy)`, current.kcal); }}>複製一張</MenuItem>
            <MenuItem icon="×" tone="danger" onClick={() => { setMenuOpen(false); setDelOpen(true); }}>剪掉這張</MenuItem>
            <MenuItem icon="◌" onClick={() => setMenuOpen(false)}>取消</MenuItem>
          </div>
        </div>
      )}

      {createOpen && (
        <FormSheet title="＋ 新底片" submitLabel="沖洗"
          onSubmit={async (n, k) => { const ok = await api.addPreset(n, k); if (ok) setCreateOpen(false); }}
          onCancel={() => setCreateOpen(false)} duplicateName={api.duplicateName}
        />
      )}
      {editOpen && current && (
        <FormSheet title={`✎ 編輯 · ${current.name}`} submitLabel="保存"
          initial={{ name: current.name, kcal: current.kcal }}
          onSubmit={async (n, k) => { const ok = await api.updatePreset(current.id, n, k); if (ok) setEditOpen(false); }}
          onCancel={() => setEditOpen(false)} duplicateName={api.duplicateName}
        />
      )}

      <InlineConfirmDialog
        open={delOpen}
        title="剪掉這張底片？"
        body={current ? <span>將永久剪掉「<span className="text-text font-medium">{current.name}</span>」。</span> : null}
        confirmText="剪掉"
        variant="danger"
        onCancel={() => setDelOpen(false)}
        onConfirm={async () => { if (current) await api.deletePreset(current.id); setDelOpen(false); }}
      />

      <style>{styles}</style>
    </PrototypeShell>
  );
}

function PerforationColumn({ side, totalRows, dragOffset }: { side: 'left' | 'right'; totalRows: number; dragOffset: number }) {
  // 每行 ITEM_HEIGHT 高，每行有 2 个 perforation holes（上下各一个）
  // 一共显示约 totalRows*2 个孔，跟 dragOffset 同步上下移动
  const holesCount = totalRows * 2 + 4;
  return (
    <div className={`film-perforation film-perforation-${side}`}>
      <div className="film-perforation-track" style={{ transform: `translateY(${dragOffset % ITEM_HEIGHT}px)` }}>
        {Array.from({ length: holesCount }, (_, i) => (
          <span key={i} className="film-hole" />
        ))}
      </div>
    </div>
  );
}

function MenuItem({ children, onClick, icon, tone }: { children: React.ReactNode; onClick: () => void; icon: string; tone?: 'danger' }) {
  return (
    <button onClick={onClick} className="w-full px-4 py-3 text-left text-[13px] hover:bg-surface active:bg-surface border-b border-hairline last:border-b-0 flex items-center gap-3">
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
        {duplicateName && <p className="text-[11px] text-danger mt-2 text-center">已存在同名底片，請改名</p>}
      </div>
    </div>
  );
}

const styles = `
@keyframes picker-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
@keyframes reel-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes reel-wobble {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(5deg); }
}

/* 入口 reel 按钮 */
.film-knob {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08) 0%, transparent 40%),
    linear-gradient(135deg, #2a2a32 0%, #15151a 60%, #0a0a0c 100%);
  border: 1.5px solid var(--color-accent);
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 10px 22px -6px rgba(0,0,0,0.8),
    0 0 0 1px rgba(255,255,255,0.04) inset;
}
.film-knob:active { transform: scale(0.92); }
.film-knob-reel {
  position: relative;
  width: 26px; height: 26px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.1) 0%, transparent 60%),
    linear-gradient(135deg, #444 0%, #1a1a1f 100%);
  border: 1px solid var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: reel-wobble 3.4s ease-in-out infinite;
}
.film-knob-hole {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0a0a0c;
  box-shadow: 0 0 0 2px rgba(200,255,0,0.3) inset;
}

/* stage */
.film-stage {
  background: linear-gradient(180deg, #0d0a0a 0%, #15131a 100%);
}

.film-icon-btn {
  width: 30px; height: 30px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 50%;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.film-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }

/* film strip */
.film-strip-wrap {
  position: relative;
  width: 100%;
  max-width: 320px;
  height: ${ITEM_HEIGHT * (VISIBLE_BEFORE + 1 + VISIBLE_AFTER)}px;
  background: #050505;
  border-radius: 4px;
  overflow: hidden;
  box-shadow:
    0 30px 70px -16px rgba(0,0,0,0.9),
    0 0 0 1px rgba(255,255,255,0.04) inset;
}

.film-highlight {
  position: absolute;
  left: 28px;
  right: 28px;
  top: 50%;
  transform: translateY(-50%);
  height: ${ITEM_HEIGHT}px;
  border: 1.5px solid var(--color-accent);
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.5) inset,
    0 0 18px rgba(200,255,0,0.18);
  pointer-events: none;
  z-index: 2;
}
.film-mask-top {
  position: absolute;
  left: 28px; right: 28px;
  top: 0;
  height: ${ITEM_HEIGHT * VISIBLE_BEFORE}px;
  background: linear-gradient(180deg, #050505 0%, rgba(5,5,5,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.film-mask-bot {
  position: absolute;
  left: 28px; right: 28px;
  bottom: 0;
  height: ${ITEM_HEIGHT * VISIBLE_AFTER}px;
  background: linear-gradient(0deg, #050505 0%, rgba(5,5,5,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}

.film-strip {
  position: absolute;
  left: 28px;
  right: 28px;
  top: 0;
  bottom: 0;
  cursor: grab;
  z-index: 1;
}
.film-strip:active { cursor: grabbing; }

.film-frame {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  padding: 2px;
  transition: opacity 0.18s;
}
.film-frame-image {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #1a1a1a 0%, #0e0e0e 100%);
  border: 1px solid #222;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 6px 14px;
  font-family: 'JetBrains Mono', monospace;
  color: #ccc;
  position: relative;
}
.film-frame-num {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 8px;
  color: var(--color-text-4);
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
}
.film-frame-name {
  font-size: 15px;
  font-weight: 600;
  color: #ddd;
  letter-spacing: -0.005em;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.film-frame-kcal {
  font-size: 10px;
  color: var(--color-text-3);
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  margin-top: 3px;
}
.film-frame-active .film-frame-image {
  background: linear-gradient(180deg, #1d2010 0%, #0a0d05 100%);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.film-frame-active .film-frame-name {
  color: var(--color-accent);
  font-size: 17px;
}
.film-frame-active .film-frame-kcal {
  color: var(--color-accent);
  font-size: 12px;
}

/* perforation columns */
.film-perforation {
  position: absolute;
  top: 0; bottom: 0;
  width: 28px;
  overflow: hidden;
  pointer-events: none;
  z-index: 4;
  background: #050505;
}
.film-perforation-left { left: 0; border-right: 1px solid #1a1a1f; }
.film-perforation-right { right: 0; border-left: 1px solid #1a1a1f; }
.film-perforation-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  padding: 8px 0;
  margin-top: -20px;
}
.film-hole {
  width: 14px;
  height: 18px;
  background: #15151a;
  border-radius: 3px;
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.6) inset,
    0 1px 2px rgba(255,255,255,0.04);
  flex-shrink: 0;
}

.film-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-align: center;
  letter-spacing: 0.06em;
  padding: 8px 0 12px;
  margin-top: 4px;
}
.film-rec {
  width: 100%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 4px;
  padding: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.18em;
  cursor: pointer;
  transition: transform 0.14s;
  box-shadow: 0 8px 20px -6px rgba(200,255,0,0.4);
}
.film-rec:active { transform: scale(0.98); }
.film-rec:disabled { opacity: 0.5; }
.film-create-cta {
  background: transparent;
  color: var(--color-accent);
  border: 1.5px solid var(--color-accent);
  border-radius: 4px;
  padding: 12px 24px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.16em;
  cursor: pointer;
}
.film-create-cta:active { transform: scale(0.96); }
`;
