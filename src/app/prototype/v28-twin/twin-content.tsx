'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { useWheelPicker } from '../_lib/wheel-picker';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Editorial Twin Picker — 主页保留。
 * 入口：右下圓形按鈕，呼吸動效（inline style 強制 right/bottom 定位）。
 * 展開：全屏雙列 picker（iOS UIDatePicker 心智）：
 *   - 左列（40%）= mode：近期 / 菜單 / 拍照（上下滑 cycle）
 *   - 右列（60%）= 跟隨 mode 切換內容：preset wheel / preset 管理 / 相機
 *   - 中央 lime 高亮 + 上下漸隱 mask
 *   - 底部大 record 按鈕
 * CRUD：
 *   - tap 大按鈕 = 記錄當前 preset（Recent/Menu mode）
 *   - 長按 Menu mode 右列高亮 = 彈 edit/delete/duplicate menu
 *   - 頂部 ＋ icon = 新建 preset
 */
const ITEM_HEIGHT = 54;
const VISIBLE_BEFORE = 2;
const VISIBLE_AFTER = 2;
const LONG_PRESS_MS = 450;

type Mode = 'recent' | 'menu' | 'camera';
const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: 'recent', label: '近期', sub: 'recent' },
  { key: 'menu',   label: '菜單', sub: 'menu' },
  { key: 'camera', label: '拍照', sub: 'camera' },
];

export function TwinContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  // 左列 mode wheel
  const modeWheel = useWheelPicker(MODES.length, ITEM_HEIGHT);
  const currentMode = MODES[modeWheel.idx]!.key;

  // 右列 preset 列表（根据 mode 不同）
  const presetList = useMemo(() => {
    if (currentMode === 'recent') {
      return [...api.presets]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);
    }
    if (currentMode === 'menu') {
      return [...api.presets].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    }
    return [];
  }, [api.presets, currentMode]);

  const presetWheel = useWheelPicker(presetList.length, ITEM_HEIGHT);
  const currentPreset = presetList[presetWheel.idx];

  // 当 mode 切换时 reset right wheel
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

  async function onMainAction() {
    if (currentMode === 'camera') {
      // TODO: hook camera
      return;
    }
    if (currentPreset) {
      const ok = await api.recordCustomPreset(currentPreset);
      if (ok) setOpen(false);
    }
  }

  const mainBtnLabel = (() => {
    if (currentMode === 'camera') return '📷 拍照識別';
    if (api.recordingId) return '記錄中…';
    if (!currentPreset) return '無 preset';
    return '● 記錄這一筆';
  })();

  return (
    <PrototypeShell title="1. Editorial Twin">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口按钮：inline style 强制定位 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open twin picker"
        className="twin-knob z-[70]"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <span className="twin-knob-dot" aria-hidden />
        <span className="twin-knob-ring" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/95 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col twin-stage"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
              animation: 'twin-in 0.3s var(--ease-out-soft) both',
            }}
          >
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">add meal</p>
                <p className="display-roman text-[24px] leading-none mt-0.5">picker</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="twin-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            {/* twin picker */}
            <div className="flex-1 flex items-center px-3 min-h-0 relative">
              <div className="twin-picker">
                {/* 中央高亮（横跨两列） */}
                <div className="twin-highlight" aria-hidden />
                {/* fade mask */}
                <div className="twin-mask-top" aria-hidden />
                <div className="twin-mask-bot" aria-hidden />

                {/* 左列：mode */}
                <div className="twin-col twin-col-left">
                  <div
                    className="twin-wheel"
                    {...modeWheel.pointerHandlers}
                    style={{ touchAction: 'none' }}
                  >
                    {Array.from({ length: VISIBLE_BEFORE + 1 + VISIBLE_AFTER }, (_, i) => {
                      const offset = i - VISIBLE_BEFORE;
                      const m = MODES[modeWheel.getOffsetIdx(offset)];
                      if (!m) return null;
                      const dist = Math.abs(offset);
                      const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.15;
                      return (
                        <div
                          key={`${m.key}-${offset}`}
                          className={`twin-row twin-row-left ${offset === 0 ? 'twin-row-active' : ''}`}
                          style={{
                            transform: `translateY(${offset * ITEM_HEIGHT + modeWheel.dragOffset}px)`,
                            opacity,
                            height: ITEM_HEIGHT,
                          }}
                        >
                          <span className="twin-mode-label">{m.label}</span>
                          <span className="twin-mode-sub">{m.sub}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 中央分隔线 */}
                <div className="twin-divider" aria-hidden />

                {/* 右列：preset wheel 或 camera */}
                <div className="twin-col twin-col-right">
                  {currentMode === 'camera' ? (
                    <div className="twin-camera">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-text-3 mt-3">camera mode</p>
                      <p className="text-[10px] text-text-4 font-mono mt-1">demo · 不接 AI</p>
                    </div>
                  ) : presetList.length === 0 ? (
                    <div className="twin-empty">
                      <p className="text-[12px] text-text-3 font-mono">no preset</p>
                      <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="twin-empty-cta">＋ NEW</button>
                    </div>
                  ) : (
                    <div
                      className="twin-wheel"
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
                        const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : 0.18;
                        return (
                          <div
                            key={`${p.id}-${offset}`}
                            className={`twin-row twin-row-right ${offset === 0 ? 'twin-row-active' : ''}`}
                            style={{
                              transform: `translateY(${offset * ITEM_HEIGHT + presetWheel.dragOffset}px)`,
                              opacity,
                              height: ITEM_HEIGHT,
                            }}
                          >
                            <span className="twin-preset-name">{p.name}</span>
                            <span className="twin-preset-kcal tabular">{Math.round(p.kcal)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* macro readout (when preset selected) */}
            {currentPreset && currentMode !== 'camera' && (
              <p className="flex-shrink-0 px-5 text-center font-mono text-[11px] tabular mb-2">
                <span style={{ color: '#c8ff00' }}>P {Math.round(currentPreset.protein_g)}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#f5a623' }}>C {Math.round(currentPreset.carb_g)}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#a486f4' }}>F {Math.round(currentPreset.fat_g)}</span>
              </p>
            )}

            {/* record button */}
            <div className="flex-shrink-0 px-5">
              <button
                onClick={onMainAction}
                disabled={(currentMode !== 'camera' && !currentPreset) || api.recordingId != null}
                className="twin-rec"
              >
                {mainBtnLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 长按 menu（仅 menu mode） */}
      {menuOpen && currentPreset && currentMode === 'menu' && (
        <div className="fixed inset-0 z-[110]" onClick={() => setMenuOpen(false)} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[28%] bg-surface-2 border border-accent/40 rounded-xl overflow-hidden min-w-[240px] shadow-2xl shadow-black/60"
            style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-[14px] text-text font-medium">{currentPreset.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">{Math.round(currentPreset.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
            </div>
            <MenuItem icon="✎" onClick={() => { setMenuOpen(false); api.clearDuplicate(); setEditOpen(true); }}>編輯</MenuItem>
            <MenuItem icon="⎘" onClick={async () => { setMenuOpen(false); api.clearDuplicate(); await api.addPreset(`${currentPreset.name} (copy)`, currentPreset.kcal); }}>複製</MenuItem>
            <MenuItem icon="×" tone="danger" onClick={() => { setMenuOpen(false); setDelOpen(true); }}>刪除</MenuItem>
            <MenuItem icon="◌" onClick={() => setMenuOpen(false)}>取消</MenuItem>
          </div>
        </div>
      )}

      {createOpen && (
        <FormSheet title="＋ 新 preset" submitLabel="保存"
          onSubmit={async (n, k) => { const ok = await api.addPreset(n, k); if (ok) setCreateOpen(false); }}
          onCancel={() => setCreateOpen(false)} duplicateName={api.duplicateName}
        />
      )}
      {editOpen && currentPreset && (
        <FormSheet title={`✎ 編輯 · ${currentPreset.name}`} submitLabel="保存"
          initial={{ name: currentPreset.name, kcal: currentPreset.kcal }}
          onSubmit={async (n, k) => { const ok = await api.updatePreset(currentPreset.id, n, k); if (ok) setEditOpen(false); }}
          onCancel={() => setEditOpen(false)} duplicateName={api.duplicateName}
        />
      )}

      <InlineConfirmDialog
        open={delOpen}
        title="刪除這個 preset？"
        body={currentPreset ? <span>將永久移除「<span className="text-text font-medium">{currentPreset.name}</span>」。</span> : null}
        confirmText="刪除"
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
@keyframes twin-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
@keyframes twin-knob-breathe {
  0%, 100% { box-shadow: 0 6px 14px -4px rgba(0,0,0,0.6), 0 0 0 0 rgba(200,255,0,0.4); }
  50%      { box-shadow: 0 6px 14px -4px rgba(0,0,0,0.6), 0 0 0 10px rgba(200,255,0,0); }
}

/* 入口圆点 */
.twin-knob {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
  animation: twin-knob-breathe 2.6s ease-in-out infinite;
  padding: 0;
}
.twin-knob:active { transform: scale(0.92); animation-play-state: paused; }
.twin-knob-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px rgba(200,255,0,0.7);
  z-index: 2;
}
.twin-knob-ring {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 1px solid rgba(200,255,0,0.18);
}

/* stage */
.twin-stage {
  background: linear-gradient(180deg, #0e0e12 0%, #15151a 100%);
}

.twin-icon-btn {
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
.twin-icon-btn:active { transform: scale(0.92); border-color: var(--color-accent); }

/* twin picker */
.twin-picker {
  position: relative;
  width: 100%;
  height: ${ITEM_HEIGHT * (VISIBLE_BEFORE + 1 + VISIBLE_AFTER)}px;
  display: flex;
  overflow: hidden;
}
.twin-highlight {
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
  box-shadow: 0 0 24px rgba(200,255,0,0.1);
}
.twin-mask-top {
  position: absolute;
  left: 0; right: 0;
  top: 0;
  height: ${ITEM_HEIGHT * VISIBLE_BEFORE}px;
  background: linear-gradient(180deg, #15151a 0%, rgba(21,21,26,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.twin-mask-bot {
  position: absolute;
  left: 0; right: 0;
  bottom: 0;
  height: ${ITEM_HEIGHT * VISIBLE_AFTER}px;
  background: linear-gradient(0deg, #15151a 0%, rgba(21,21,26,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.twin-divider {
  position: absolute;
  left: 38%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--color-hairline);
  z-index: 2;
}

.twin-col {
  position: relative;
  height: 100%;
  flex-shrink: 0;
}
.twin-col-left { width: 38%; }
.twin-col-right { width: 62%; }

.twin-wheel {
  position: absolute;
  inset: 0;
  cursor: grab;
  z-index: 1;
}
.twin-wheel:active { cursor: grabbing; }

.twin-row {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  align-items: center;
  transition: opacity 0.18s, transform 0.18s var(--ease-out-soft);
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
}
.twin-row-left {
  flex-direction: column;
  justify-content: center;
  text-align: center;
  gap: 1px;
}
.twin-row-right {
  justify-content: space-between;
  padding: 0 16px 0 20px;
}
.twin-mode-label {
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text);
  letter-spacing: 0.04em;
  line-height: 1;
}
.twin-mode-sub {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--color-text-3);
  font-family: 'JetBrains Mono', monospace;
}
.twin-row-active .twin-mode-label {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-accent);
}
.twin-row-active .twin-mode-sub {
  color: var(--color-accent);
  opacity: 0.7;
}
.twin-preset-name {
  flex: 1;
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.twin-preset-kcal {
  font-size: 14px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
  margin-left: 10px;
  font-weight: 400;
}
.twin-row-right.twin-row-active .twin-preset-name {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-accent);
}
.twin-row-right.twin-row-active .twin-preset-kcal {
  font-size: 16px;
  color: var(--color-accent);
  font-weight: 600;
}

.twin-camera {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  z-index: 4;
}
.twin-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 4;
}
.twin-empty-cta {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.12em;
  cursor: pointer;
}
.twin-empty-cta:active { transform: scale(0.95); }

.twin-rec {
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
.twin-rec:active { transform: scale(0.98); }
.twin-rec:disabled { opacity: 0.4; }
`;
