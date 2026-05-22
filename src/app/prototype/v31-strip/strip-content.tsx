'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { useWheelPicker } from '../_lib/wheel-picker';
import { useDelayedCommit } from '../_lib/use-delayed-commit';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * v31 Strip + Wheel：半弹窗，顶部 mode 横向 strip + 下方 preset 垂直 wheel。
 * 滑动 mode strip 时丝滑跟手，停 1.2s 才提交切换右侧内容。
 * 按钮图案：三横线 picker icon（中行加粗）+ 中行轻微宽窄呼吸。
 */
const ITEM_HEIGHT = 52;
const MODE_ITEM_WIDTH = 110;
const VISIBLE_BEFORE = 2;
const VISIBLE_AFTER = 2;
const LONG_PRESS_MS = 450;
const COMMIT_DELAY = 1200;

type Mode = 'recent' | 'menu' | 'camera';
const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: 'recent', label: '近期', sub: 'recent' },
  { key: 'menu',   label: '菜單', sub: 'menu' },
  { key: 'camera', label: '拍照', sub: 'camera' },
];

export function StripContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  // 探索 idx（实时跟手） + 提交 idx（延迟 1.2s）
  const modeWheel = useHWheelPicker(MODES.length, MODE_ITEM_WIDTH);
  const exploreModeIdx = modeWheel.idx;
  const committedModeIdx = useDelayedCommit(exploreModeIdx, COMMIT_DELAY);
  const committedMode = MODES[committedModeIdx]!.key;
  const isExploring = exploreModeIdx !== committedModeIdx;

  const presetList = useMemo(() => {
    if (committedMode === 'recent') {
      return [...api.presets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
    }
    if (committedMode === 'menu') {
      return [...api.presets].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    }
    return [];
  }, [api.presets, committedMode]);

  const presetWheel = useWheelPicker(presetList.length, ITEM_HEIGHT);
  const currentPreset = presetList[presetWheel.idx];

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

  return (
    <PrototypeShell title="1. Strip + Wheel">
      <RealHomeShell api={api} rightAction={null} />

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open strip picker"
        className="z-[70]"
        style={{ position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <span className="strip-knob">
          <span className="strip-knob-line strip-knob-line-1" />
          <span className="strip-knob-line strip-knob-line-mid" />
          <span className="strip-knob-line strip-knob-line-3" />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 bottom-0 strip-sheet"
            style={{
              height: '68vh',
              animation: 'sheet-up 0.32s var(--ease-out-soft) both',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="strip-handle" />
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[20px] leading-none mt-0.5">picker</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="strip-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            {/* mode strip */}
            <div className="flex-shrink-0 strip-mode-wrap">
              <div className="strip-mode-highlight" aria-hidden />
              <div className="strip-mode-mask-l" aria-hidden />
              <div className="strip-mode-mask-r" aria-hidden />
              <div
                className="strip-mode-track"
                {...modeWheel.pointerHandlers}
                style={{ touchAction: 'none' }}
              >
                {MODES.map((m, i) => {
                  const offset = i - exploreModeIdx;
                  // 用 wrap 算最近循环距离
                  const wrappedOff = ((offset + MODES.length / 2) % MODES.length) - MODES.length / 2;
                  const isCenter = i === exploreModeIdx;
                  const isCommitted = i === committedModeIdx;
                  return (
                    <div
                      key={m.key}
                      className={`strip-mode-cell ${isCenter ? 'strip-mode-cell-center' : ''} ${isCommitted ? 'strip-mode-cell-committed' : ''}`}
                      style={{
                        transform: `translateX(${wrappedOff * MODE_ITEM_WIDTH + modeWheel.dragOffset}px)`,
                        opacity: Math.abs(wrappedOff) === 0 ? 1 : Math.abs(wrappedOff) === 1 ? 0.4 : 0.15,
                      }}
                    >
                      <span className="strip-mode-label">{m.label}</span>
                      <span className="strip-mode-sub">{m.sub}</span>
                    </div>
                  );
                })}
              </div>
              {isExploring && <p className="strip-exploring">⟳ exploring · {MODES[exploreModeIdx]!.label} · hold to commit</p>}
              {!isExploring && currentPreset && <p className="strip-committed">▸ {MODES[committedModeIdx]!.label} · committed</p>}
            </div>

            {/* preset wheel */}
            <div className="flex-1 px-3 min-h-0 relative">
              {committedMode === 'camera' ? (
                <div className="strip-camera">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <p className="text-[12px] font-mono uppercase tracking-wider text-text-3 mt-3">camera mode</p>
                  <p className="text-[10px] text-text-4 font-mono mt-1">demo · 不接 AI</p>
                </div>
              ) : presetList.length === 0 ? (
                <div className="strip-empty">
                  <p className="text-[13px] text-text-3 font-mono">no preset</p>
                  <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="strip-empty-cta">＋ new</button>
                </div>
              ) : (
                <div className="strip-wheel-wrap">
                  <div className="strip-wheel-highlight" aria-hidden />
                  <div className="strip-wheel-mask-t" aria-hidden />
                  <div className="strip-wheel-mask-b" aria-hidden />
                  <div
                    className="strip-wheel"
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
                      const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : 0.18;
                      return (
                        <div
                          key={`${p.id}-${offset}`}
                          className={`strip-preset-row ${offset === 0 ? 'strip-preset-row-active' : ''}`}
                          style={{
                            transform: `translateY(${offset * ITEM_HEIGHT + presetWheel.dragOffset}px)`,
                            opacity,
                            height: ITEM_HEIGHT,
                          }}
                        >
                          <span className="strip-preset-name">{p.name}</span>
                          <span className="strip-preset-kcal tabular">{Math.round(p.kcal)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {currentPreset && committedMode !== 'camera' && (
              <p className="flex-shrink-0 px-5 text-center font-mono text-[11px] tabular mb-2">
                <span style={{ color: '#c8ff00' }}>P {Math.round(currentPreset.protein_g)}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#f5a623' }}>C {Math.round(currentPreset.carb_g)}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#a486f4' }}>F {Math.round(currentPreset.fat_g)}</span>
              </p>
            )}

            <div className="flex-shrink-0 px-5 pb-3">
              <button onClick={onRec} disabled={(committedMode !== 'camera' && !currentPreset) || api.recordingId != null} className="strip-rec">
                {api.recordingId ? 'recording…' : committedMode === 'camera' ? '📷 拍照' : '● 記錄這一筆'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CrudModals
        api={api}
        currentPreset={currentPreset}
        showLongPress={menuOpen && committedMode === 'menu'}
        showCreate={createOpen}
        showEdit={editOpen}
        showDel={delOpen}
        setMenuOpen={setMenuOpen}
        setCreateOpen={setCreateOpen}
        setEditOpen={setEditOpen}
        setDelOpen={setDelOpen}
      />

      <style>{styles}</style>
    </PrototypeShell>
  );
}

// 横向 wheel hook（参考 useWheelPicker 但是 X 轴）
function useHWheelPicker(itemCount: number, itemWidth: number) {
  const [idx, setIdx] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef<number | null>(null);
  const lastXRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);
  const velRef = useRef<number>(0);

  const safeIdx = itemCount === 0 ? 0 : ((idx % itemCount) + itemCount) % itemCount;

  function onPointerDown(e: React.PointerEvent) {
    if (itemCount === 0) return;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTRef.current = Date.now();
    velRef.current = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startXRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    setDragOffset(dx);
    if (lastXRef.current != null && lastTRef.current != null) {
      const dt = Date.now() - lastTRef.current;
      if (dt > 0) velRef.current = (e.clientX - lastXRef.current) / dt;
    }
    lastXRef.current = e.clientX;
    lastTRef.current = Date.now();
  }
  function onPointerUp() {
    if (startXRef.current == null) return;
    const dx = dragOffset;
    let stepShift = -Math.round(dx / itemWidth);
    if (Math.abs(velRef.current) > 0.4) stepShift += -Math.round(velRef.current * 6);
    if (itemCount > 0 && stepShift !== 0) {
      setIdx((i) => ((i + stepShift) % itemCount + itemCount) % itemCount);
    }
    setDragOffset(0);
    startXRef.current = null;
    lastXRef.current = null;
    lastTRef.current = null;
    velRef.current = 0;
  }
  function onPointerCancel() {
    setDragOffset(0);
    startXRef.current = null;
    lastXRef.current = null;
    lastTRef.current = null;
    velRef.current = 0;
  }

  return {
    idx: safeIdx,
    setIdx,
    dragOffset,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

function CrudModals({
  api, currentPreset, showLongPress, showCreate, showEdit, showDel,
  setMenuOpen, setCreateOpen, setEditOpen, setDelOpen,
}: any) {
  return (
    <>
      {showLongPress && currentPreset && (
        <div className="fixed inset-0 z-[110]" onClick={() => setMenuOpen(false)} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[30%] bg-surface-2 border border-accent/40 rounded-xl overflow-hidden min-w-[240px] shadow-2xl shadow-black/60"
            style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-[14px] text-text font-medium">{currentPreset.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">{Math.round(currentPreset.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
            </div>
            <MItem icon="✎" onClick={() => { setMenuOpen(false); api.clearDuplicate(); setEditOpen(true); }}>編輯</MItem>
            <MItem icon="⎘" onClick={async () => { setMenuOpen(false); api.clearDuplicate(); await api.addPreset(`${currentPreset.name} (copy)`, currentPreset.kcal); }}>複製</MItem>
            <MItem icon="×" tone="danger" onClick={() => { setMenuOpen(false); setDelOpen(true); }}>刪除</MItem>
            <MItem icon="◌" onClick={() => setMenuOpen(false)}>取消</MItem>
          </div>
        </div>
      )}
      {showCreate && (
        <FSheet title="＋ 新 preset" submitLabel="保存"
          onSubmit={async (n: string, k: number) => { const ok = await api.addPreset(n, k); if (ok) setCreateOpen(false); }}
          onCancel={() => setCreateOpen(false)} duplicateName={api.duplicateName}
        />
      )}
      {showEdit && currentPreset && (
        <FSheet title={`✎ 編輯 · ${currentPreset.name}`} submitLabel="保存"
          initial={{ name: currentPreset.name, kcal: currentPreset.kcal }}
          onSubmit={async (n: string, k: number) => { const ok = await api.updatePreset(currentPreset.id, n, k); if (ok) setEditOpen(false); }}
          onCancel={() => setEditOpen(false)} duplicateName={api.duplicateName}
        />
      )}
      <InlineConfirmDialog
        open={showDel}
        title="刪除這個 preset？"
        body={currentPreset ? <span>將永久移除「<span className="text-text font-medium">{currentPreset.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setDelOpen(false)}
        onConfirm={async () => { if (currentPreset) await api.deletePreset(currentPreset.id); setDelOpen(false); }}
      />
    </>
  );
}

function MItem({ children, onClick, icon, tone }: { children: React.ReactNode; onClick: () => void; icon: string; tone?: 'danger' }) {
  return (
    <button onClick={onClick} className="w-full px-4 py-3 text-left text-[13px] hover:bg-surface active:bg-surface border-b border-hairline last:border-b-0 flex items-center gap-3">
      <span className={`w-4 text-center ${tone === 'danger' ? 'text-danger' : 'text-text-3'}`}>{icon}</span>
      <span className={tone === 'danger' ? 'text-danger' : 'text-text'}>{children}</span>
    </button>
  );
}

function FSheet({ title, submitLabel, initial, onSubmit, onCancel, duplicateName }: {
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
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
@keyframes strip-mid-breath {
  0%, 100% { width: 22px; }
  50% { width: 30px; }
}

/* 按钮 = 三横线 picker icon */
.strip-knob {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 18px -4px rgba(0,0,0,0.7);
}
.strip-knob-line {
  display: block;
  height: 2px;
  background: var(--color-accent);
  border-radius: 999px;
}
.strip-knob-line-1 { width: 22px; opacity: 0.7; }
.strip-knob-line-mid { width: 30px; opacity: 1; animation: strip-mid-breath 2.6s ease-in-out infinite; box-shadow: 0 0 6px rgba(200,255,0,0.6); }
.strip-knob-line-3 { width: 22px; opacity: 0.7; }

.strip-sheet {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #161620 0%, #0e0e12 100%);
  border-top: 1px solid var(--color-accent);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  box-shadow: 0 -22px 50px -10px rgba(0,0,0,0.7);
}
.strip-handle {
  width: 36px; height: 4px;
  background: var(--color-hairline-strong);
  border-radius: 999px;
  margin: 8px auto 4px;
}

.strip-icon-btn {
  width: 30px; height: 30px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.strip-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }

/* mode strip */
.strip-mode-wrap {
  position: relative;
  height: 76px;
  margin: 4px 0 8px;
  overflow: hidden;
}
.strip-mode-highlight {
  position: absolute;
  left: 50%;
  top: 8px;
  transform: translateX(-50%);
  width: 96px;
  height: 50px;
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  background: rgba(200, 255, 0, 0.06);
  pointer-events: none;
  z-index: 1;
}
.strip-mode-mask-l, .strip-mode-mask-r {
  position: absolute;
  top: 0; bottom: 0;
  width: 60px;
  pointer-events: none;
  z-index: 2;
}
.strip-mode-mask-l {
  left: 0;
  background: linear-gradient(90deg, #161620 0%, rgba(22,22,32,0.7) 60%, transparent 100%);
}
.strip-mode-mask-r {
  right: 0;
  background: linear-gradient(-90deg, #161620 0%, rgba(22,22,32,0.7) 60%, transparent 100%);
}
.strip-mode-track {
  position: absolute;
  left: 50%;
  top: 8px;
  bottom: 28px;
  width: ${MODE_ITEM_WIDTH}px;
  margin-left: -${MODE_ITEM_WIDTH / 2}px;
  cursor: grab;
  touch-action: none;
}
.strip-mode-track:active { cursor: grabbing; }
.strip-mode-cell {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -25px;
  height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: opacity 0.18s;
}
.strip-mode-label {
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1;
}
.strip-mode-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--color-text-3);
  margin-top: 2px;
}
.strip-mode-cell-center .strip-mode-label { font-size: 24px; }
.strip-mode-cell-committed .strip-mode-label { color: var(--color-accent); font-weight: 700; }
.strip-mode-cell-committed .strip-mode-sub { color: var(--color-accent); opacity: 0.7; }

.strip-exploring, .strip-committed {
  position: absolute;
  left: 50%;
  bottom: 4px;
  transform: translateX(-50%);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: lowercase;
  white-space: nowrap;
}
.strip-exploring { color: rgba(200, 255, 0, 0.6); }
.strip-committed { color: var(--color-accent); }

/* preset wheel */
.strip-wheel-wrap {
  position: relative;
  width: 100%;
  height: ${ITEM_HEIGHT * (VISIBLE_BEFORE + 1 + VISIBLE_AFTER)}px;
  overflow: hidden;
}
.strip-wheel-highlight {
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
.strip-wheel-mask-t, .strip-wheel-mask-b {
  position: absolute;
  left: 0; right: 0;
  pointer-events: none;
  z-index: 3;
}
.strip-wheel-mask-t {
  top: 0;
  height: ${ITEM_HEIGHT * VISIBLE_BEFORE}px;
  background: linear-gradient(180deg, #0e0e12 0%, rgba(14,14,18,0.7) 60%, transparent 100%);
}
.strip-wheel-mask-b {
  bottom: 0;
  height: ${ITEM_HEIGHT * VISIBLE_AFTER}px;
  background: linear-gradient(0deg, #0e0e12 0%, rgba(14,14,18,0.7) 60%, transparent 100%);
}
.strip-wheel {
  position: absolute;
  inset: 0;
  cursor: grab;
  z-index: 1;
}
.strip-wheel:active { cursor: grabbing; }
.strip-preset-row {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  transition: opacity 0.18s, transform 0.18s;
}
.strip-preset-name {
  flex: 1;
  font-size: 18px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.strip-preset-kcal {
  font-size: 14px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  margin-left: 10px;
}
.strip-preset-row-active .strip-preset-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-accent);
}
.strip-preset-row-active .strip-preset-kcal {
  font-size: 18px;
  color: var(--color-accent);
}

.strip-camera, .strip-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  gap: 10px;
}
.strip-empty-cta {
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

.strip-rec {
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
.strip-rec:active { transform: scale(0.98); }
.strip-rec:disabled { opacity: 0.4; }
`;
