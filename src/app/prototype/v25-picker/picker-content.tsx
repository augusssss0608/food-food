'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { useWheelPicker } from '../_lib/wheel-picker';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * iOS Picker 經典時間選擇器 — 主页保留。
 * 入口：右下小圓點按鈕（呼吸動效）。
 * 展開：全屏 picker spinner（垂直滾輪）+ 中間 lime 高亮 + 首尾循環。
 * CRUD：tap 高亮 = 記錄；長按高亮 = 編輯/刪除/複製；頂部 ＋ 新建。
 */
const ITEM_HEIGHT = 56;
const VISIBLE_BEFORE = 3;
const VISIBLE_AFTER = 3;
const LONG_PRESS_MS = 450;

export function PickerContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  // 排序：最近 created 在前
  const presets = useMemo(() => {
    return [...api.presets].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [api.presets]);

  const wheel = useWheelPicker(presets.length, ITEM_HEIGHT);
  const current = presets[wheel.idx];

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onCenterPointerDown(e: React.PointerEvent) {
    // 同时把 pointer 给 wheel handler（允许拖动），但额外计时长按
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
    // 拖动超过一点距离就取消长按计时
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
    <PrototypeShell title="1. iOS Picker">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：右下小圆点 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open picker"
        className="fixed right-5 z-[70] picker-knob"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <span className="picker-knob-dot" aria-hidden />
        <span className="picker-knob-lines" aria-hidden>
          <span /><span /><span />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/90 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col picker-stage"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
              animation: 'picker-in 0.3s var(--ease-out-soft) both',
            }}
          >
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pb-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-mono">picker</p>
                <p className="text-[10px] font-mono text-text-3 mt-0.5">
                  {presets.length} preset · drag · tap = log · hold = edit
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { api.clearDuplicate(); setCreateOpen(true); }}
                  className="picker-icon-btn"
                  aria-label="new preset"
                >＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            {/* picker wheel */}
            <div className="flex-1 flex flex-col items-center justify-center px-5 min-h-0">
              {presets.length === 0 ? (
                <div className="text-center">
                  <p className="text-[14px] text-text-3 font-mono mb-4">no preset</p>
                  <button
                    onClick={() => { api.clearDuplicate(); setCreateOpen(true); }}
                    className="picker-create-cta"
                  >＋ 建立第一個</button>
                </div>
              ) : (
                <div className="picker-wheel-wrap">
                  {/* 中央高亮指示器 */}
                  <div className="picker-highlight" aria-hidden />
                  {/* 渐变 mask */}
                  <div className="picker-mask-top" aria-hidden />
                  <div className="picker-mask-bot" aria-hidden />
                  {/* wheel */}
                  <div
                    className="picker-wheel"
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
                      // 每一行的视觉透明度 + scale 按距离衰减
                      const dist = Math.abs(offset);
                      const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.28 : 0.12;
                      const scale = dist === 0 ? 1 : 1 - dist * 0.06;
                      return (
                        <div
                          key={`${p.id}-${offset}`}
                          className={`picker-row ${offset === 0 ? 'picker-row-active' : ''}`}
                          style={{
                            transform: `translateY(${offset * ITEM_HEIGHT + wheel.dragOffset}px) scale(${scale})`,
                            opacity,
                            height: ITEM_HEIGHT,
                          }}
                        >
                          <span className="picker-row-name">{p.name}</span>
                          <span className="picker-row-kcal tabular">{Math.round(p.kcal)}</span>
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
                <p className="picker-macro tabular">
                  <span style={{ color: '#c8ff00' }}>P {Math.round(current.protein_g)}</span>
                  <span className="opacity-50 mx-2">·</span>
                  <span style={{ color: '#f5a623' }}>C {Math.round(current.carb_g)}</span>
                  <span className="opacity-50 mx-2">·</span>
                  <span style={{ color: '#a486f4' }}>F {Math.round(current.fat_g)}</span>
                  <span className="opacity-50 mx-2">·</span>
                  <span className="text-text-3">Fi {Math.round(current.fiber_g)}</span>
                </p>
                <button
                  onClick={recordCurrent}
                  disabled={api.recordingId != null}
                  className="picker-rec"
                >
                  {api.recordingId ? 'recording…' : '● 記錄這一筆'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 长按 menu */}
      {menuOpen && current && (
        <div className="fixed inset-0 z-[110]" onClick={() => setMenuOpen(false)} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-[28%] bg-surface-2 border border-accent/40 rounded-xl overflow-hidden min-w-[240px] shadow-2xl shadow-black/60"
            style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-[14px] text-text font-medium">{current.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">
                {Math.round(current.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
              </p>
            </div>
            <MenuItem icon="✎" onClick={() => { setMenuOpen(false); api.clearDuplicate(); setEditOpen(true); }}>編輯</MenuItem>
            <MenuItem icon="⎘" onClick={async () => { setMenuOpen(false); api.clearDuplicate(); await api.addPreset(`${current.name} (copy)`, current.kcal); }}>複製</MenuItem>
            <MenuItem icon="×" tone="danger" onClick={() => { setMenuOpen(false); setDelOpen(true); }}>刪除</MenuItem>
            <MenuItem icon="◌" onClick={() => setMenuOpen(false)}>取消</MenuItem>
          </div>
        </div>
      )}

      {createOpen && (
        <FormSheet
          title="＋ 新 preset"
          submitLabel="保存"
          onSubmit={async (name, kcal) => {
            const ok = await api.addPreset(name, kcal);
            if (ok) setCreateOpen(false);
          }}
          onCancel={() => setCreateOpen(false)}
          duplicateName={api.duplicateName}
        />
      )}

      {editOpen && current && (
        <FormSheet
          title={`✎ 編輯 · ${current.name}`}
          submitLabel="保存"
          initial={{ name: current.name, kcal: current.kcal }}
          onSubmit={async (name, kcal) => {
            const ok = await api.updatePreset(current.id, name, kcal);
            if (ok) setEditOpen(false);
          }}
          onCancel={() => setEditOpen(false)}
          duplicateName={api.duplicateName}
        />
      )}

      <InlineConfirmDialog
        open={delOpen}
        title="刪除這個 preset？"
        body={current ? <span>將永久移除「<span className="text-text font-medium">{current.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setDelOpen(false)}
        onConfirm={async () => {
          if (current) await api.deletePreset(current.id);
          setDelOpen(false);
        }}
      />

      <style>{styles}</style>
    </PrototypeShell>
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
        {duplicateName && <p className="text-[11px] text-danger mt-2 text-center">已存在同名 preset，請改名</p>}
      </div>
    </div>
  );
}

const styles = `
@keyframes picker-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
@keyframes knob-breathe {
  0%, 100% { transform: scale(1); box-shadow: 0 6px 14px -4px rgba(0,0,0,0.6), 0 0 0 0 rgba(200,255,0,0.4); }
  50% { transform: scale(1.06); box-shadow: 0 6px 14px -4px rgba(0,0,0,0.6), 0 0 0 8px rgba(200,255,0,0); }
}

/* 入口圆点 */
.picker-knob {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
  animation: knob-breathe 2.6s ease-in-out infinite;
  position: relative;
}
.picker-knob:active { transform: scale(0.92) !important; animation-play-state: paused; }
.picker-knob-dot {
  position: absolute;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 6px rgba(200,255,0,0.7);
}
.picker-knob-lines {
  display: none;  /* 仅占位 */
}

/* stage */
.picker-stage {
  background: linear-gradient(180deg, #0e0e12 0%, #15151a 100%);
}

.picker-icon-btn {
  width: 28px; height: 28px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.picker-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }

/* picker wheel */
.picker-wheel-wrap {
  position: relative;
  width: 100%;
  max-width: 360px;
  height: ${ITEM_HEIGHT * (VISIBLE_BEFORE + 1 + VISIBLE_AFTER)}px;
  overflow: hidden;
}
.picker-highlight {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: ${ITEM_HEIGHT}px;
  border-top: 1px solid var(--color-accent);
  border-bottom: 1px solid var(--color-accent);
  background: rgba(200, 255, 0, 0.06);
  pointer-events: none;
  z-index: 2;
  box-shadow:
    0 0 0 1px rgba(200,255,0,0.15) inset,
    0 0 16px rgba(200,255,0,0.12);
}
.picker-mask-top {
  position: absolute;
  left: 0; right: 0;
  top: 0;
  height: ${ITEM_HEIGHT * VISIBLE_BEFORE}px;
  background: linear-gradient(180deg, #15151a 0%, rgba(21,21,26,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.picker-mask-bot {
  position: absolute;
  left: 0; right: 0;
  bottom: 0;
  height: ${ITEM_HEIGHT * VISIBLE_AFTER}px;
  background: linear-gradient(0deg, #15151a 0%, rgba(21,21,26,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.picker-wheel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  cursor: grab;
  z-index: 1;
}
.picker-wheel:active { cursor: grabbing; }
.picker-row {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 22px;
  color: var(--color-text);
  font-weight: 500;
  transition: opacity 0.18s, transform 0.18s var(--ease-out-soft);
}
.picker-row-active {
  font-size: 26px;
  font-weight: 600;
  color: var(--color-accent);
}
.picker-row-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.picker-row-kcal {
  font-size: 16px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  font-weight: 400;
  margin-left: 12px;
}
.picker-row-active .picker-row-kcal {
  color: var(--color-accent);
  font-size: 18px;
  font-weight: 600;
}

/* macro + record */
.picker-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-align: center;
  letter-spacing: 0.04em;
  padding: 8px 0 12px;
  border-top: 1px solid var(--color-hairline);
  margin-top: 4px;
}
.picker-rec {
  width: 100%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 12px;
  padding: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  transition: transform 0.14s;
  box-shadow: 0 8px 20px -6px rgba(200,255,0,0.4);
}
.picker-rec:active { transform: scale(0.98); }
.picker-rec:disabled { opacity: 0.5; }
.picker-create-cta {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 10px;
  padding: 12px 20px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.08em;
  cursor: pointer;
}
.picker-create-cta:active { transform: scale(0.96); }
`;
