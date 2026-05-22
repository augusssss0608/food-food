'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { useWheelPicker } from '../_lib/wheel-picker';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Folding Codex 古籍 — 主页保留。
 * 入口：右下书脊样式按钮。
 * 展开：cream 纸张 + 烫金边 + Fraunces 衍线大字。
 *   - 左书脊（章节书签）= mode
 *   - 右书页（内容）= 跟随 mode
 *   - 中间烫金分隔
 *   - 底部 cream 古典 record 按键
 * 视觉锚点：暖米色 + 深棕 + 烫金 + grain texture + 古典 ornaments。
 */
const ITEM_HEIGHT = 56;
const VISIBLE_BEFORE = 2;
const VISIBLE_AFTER = 2;
const LONG_PRESS_MS = 450;

type Mode = 'recent' | 'menu' | 'camera';
const MODES: { key: Mode; label: string; sub: string; chapter: string }[] = [
  { key: 'recent', label: '近期', sub: 'recens',  chapter: 'I'   },
  { key: 'menu',   label: '菜單', sub: 'index',   chapter: 'II'  },
  { key: 'camera', label: '拍照', sub: 'imago',   chapter: 'III' },
];

export function CodexContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const modeWheel = useWheelPicker(MODES.length, ITEM_HEIGHT);
  const currentModeInfo = MODES[modeWheel.idx]!;
  const currentMode = currentModeInfo.key;

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

  async function onSeal() {
    if (currentMode === 'camera') return;
    if (currentPreset) {
      const ok = await api.recordCustomPreset(currentPreset);
      if (ok) setOpen(false);
    }
  }

  return (
    <PrototypeShell title="3. Folding Codex">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：书脊按钮 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open codex"
        className="codex-knob z-[70]"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <span className="codex-knob-band codex-knob-band-1" aria-hidden />
        <span className="codex-knob-band codex-knob-band-2" aria-hidden />
        <span className="codex-knob-spine" aria-hidden />
        <span className="codex-knob-emboss">CDX</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col codex-stage"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
              animation: 'codex-in 0.4s var(--ease-out-soft) both',
            }}
          >
            {/* ornament header */}
            <div className="flex-shrink-0 px-5 pb-2 flex items-center justify-between">
              <div>
                <p className="codex-folio">FOLIO · {modeWheel.idx + 1}/3</p>
                <p className="codex-title">food <span className="display">·</span> codex</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="codex-icon-btn" aria-label="new preset">＋</button>
                <button onClick={() => setOpen(false)} className="codex-close-btn">close</button>
              </div>
            </div>
            <div className="codex-ornament-bar" aria-hidden>
              <span>❦</span>
              <span className="codex-ornament-line" />
              <span>❧</span>
              <span className="codex-ornament-line" />
              <span>❦</span>
            </div>

            {/* twin spread (book layout) */}
            <div className="flex-1 px-3 min-h-0 mt-2 relative">
              <div className="codex-spread">
                {/* page texture overlay */}
                <div className="codex-paper-grain" aria-hidden />

                {/* 左书脊（章节书签） */}
                <div className="codex-spine">
                  <div
                    className="codex-wheel"
                    {...modeWheel.pointerHandlers}
                    style={{ touchAction: 'none' }}
                  >
                    {Array.from({ length: VISIBLE_BEFORE + 1 + VISIBLE_AFTER }, (_, i) => {
                      const offset = i - VISIBLE_BEFORE;
                      const m = MODES[modeWheel.getOffsetIdx(offset)];
                      if (!m) return null;
                      const dist = Math.abs(offset);
                      const opacity = dist === 0 ? 1 : dist === 1 ? 0.4 : 0.15;
                      return (
                        <div
                          key={`${m.key}-${offset}`}
                          className={`codex-tab ${offset === 0 ? 'codex-tab-active' : ''}`}
                          style={{
                            transform: `translateY(${offset * ITEM_HEIGHT + modeWheel.dragOffset}px)`,
                            opacity,
                            height: ITEM_HEIGHT,
                          }}
                        >
                          <span className="codex-tab-chapter">{m.chapter}</span>
                          <span className="codex-tab-label">{m.label}</span>
                          <span className="codex-tab-sub">{m.sub}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 烫金分隔 */}
                <div className="codex-divider" aria-hidden>
                  <span className="codex-divider-cap codex-divider-cap-top">✦</span>
                  <span className="codex-divider-cap codex-divider-cap-bot">✦</span>
                </div>

                {/* 右书页（内容） */}
                <div className="codex-page">
                  <div className="codex-page-header">
                    <p className="codex-page-chapter">Caput · {currentModeInfo.chapter}</p>
                    <p className="codex-page-heading display-roman">{currentModeInfo.label}</p>
                  </div>
                  <div className="codex-page-body">
                    {currentMode === 'camera' ? (
                      <div className="codex-camera">
                        <span className="codex-camera-glyph">◉</span>
                        <p className="codex-camera-label display-roman">imago capta</p>
                        <p className="codex-camera-hint">demo · 不接 AI</p>
                      </div>
                    ) : presetList.length === 0 ? (
                      <div className="codex-empty">
                        <p className="display-roman codex-empty-title">tabula rasa</p>
                        <p className="codex-empty-sub">尚無 preset</p>
                        <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="codex-empty-cta">＋ 新建</button>
                      </div>
                    ) : (
                      <div className="codex-preset-wrap">
                        <div className="codex-preset-highlight" aria-hidden />
                        <div className="codex-preset-mask-top" aria-hidden />
                        <div className="codex-preset-mask-bot" aria-hidden />
                        <div
                          className="codex-wheel"
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
                                className={`codex-entry ${offset === 0 ? 'codex-entry-active' : ''}`}
                                style={{
                                  transform: `translateY(${offset * ITEM_HEIGHT + presetWheel.dragOffset}px)`,
                                  opacity,
                                  height: ITEM_HEIGHT,
                                }}
                              >
                                <span className="codex-entry-name">{p.name}</span>
                                <span className="codex-entry-kcal tabular">{Math.round(p.kcal)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* macro 古典 colophon */}
            {currentPreset && currentMode !== 'camera' && (
              <p className="flex-shrink-0 codex-colophon tabular">
                <span style={{ color: '#3a5a1a' }}>P {Math.round(currentPreset.protein_g)}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#a05a0a' }}>C {Math.round(currentPreset.carb_g)}</span>
                <span className="opacity-50 mx-2">·</span>
                <span style={{ color: '#5a3a8a' }}>F {Math.round(currentPreset.fat_g)}</span>
              </p>
            )}

            {/* 烫金 record 按键 */}
            <div className="flex-shrink-0 px-5 pt-1">
              <button
                onClick={onSeal}
                disabled={(currentMode !== 'camera' && !currentPreset) || api.recordingId != null}
                className="codex-seal"
              >
                <span className="codex-seal-emblem">✦</span>
                <span className="codex-seal-text display-roman">
                  {api.recordingId ? 'sealing…' : currentMode === 'camera' ? 'capture' : 'seal entry'}
                </span>
                <span className="codex-seal-emblem">✦</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && currentPreset && currentMode === 'menu' && (
        <div className="fixed inset-0 z-[110]" onClick={() => setMenuOpen(false)} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[28%] codex-menu"
            style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="codex-menu-head">
              <p className="codex-menu-name display-roman">{currentPreset.name}</p>
              <p className="codex-menu-kcal tabular">{Math.round(currentPreset.kcal)} kcal</p>
            </div>
            <MenuItem icon="✎" onClick={() => { setMenuOpen(false); api.clearDuplicate(); setEditOpen(true); }}>修訂</MenuItem>
            <MenuItem icon="⎘" onClick={async () => { setMenuOpen(false); api.clearDuplicate(); await api.addPreset(`${currentPreset.name} (copy)`, currentPreset.kcal); }}>謄抄</MenuItem>
            <MenuItem icon="×" tone="danger" onClick={() => { setMenuOpen(false); setDelOpen(true); }}>刪除</MenuItem>
            <MenuItem icon="◌" onClick={() => setMenuOpen(false)}>取消</MenuItem>
          </div>
        </div>
      )}

      {createOpen && (
        <FormSheet title="＋ 新條目" submitLabel="入冊"
          onSubmit={async (n, k) => { const ok = await api.addPreset(n, k); if (ok) setCreateOpen(false); }}
          onCancel={() => setCreateOpen(false)} duplicateName={api.duplicateName}
        />
      )}
      {editOpen && currentPreset && (
        <FormSheet title={`✎ 修訂 · ${currentPreset.name}`} submitLabel="保存"
          initial={{ name: currentPreset.name, kcal: currentPreset.kcal }}
          onSubmit={async (n, k) => { const ok = await api.updatePreset(currentPreset.id, n, k); if (ok) setEditOpen(false); }}
          onCancel={() => setEditOpen(false)} duplicateName={api.duplicateName}
        />
      )}

      <InlineConfirmDialog
        open={delOpen}
        title="從冊中刪除？"
        body={currentPreset ? <span>將永久刪除「<span className="text-text font-medium">{currentPreset.name}</span>」這一條目。</span> : null}
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
    <button onClick={onClick} className="codex-menu-item">
      <span className={`codex-menu-icon ${tone === 'danger' ? 'codex-menu-icon-danger' : ''}`}>{icon}</span>
      <span className={tone === 'danger' ? 'codex-menu-text-danger' : ''}>{children}</span>
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
        {duplicateName && <p className="text-[11px] text-danger mt-2 text-center">已存在同名條目，請改名</p>}
      </div>
    </div>
  );
}

const styles = `
@keyframes codex-in {
  from { opacity: 0; transform: scale(0.92) rotateX(8deg); }
  to   { opacity: 1; transform: scale(1) rotateX(0deg); }
}
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
@keyframes codex-knob-breathe {
  0%, 100% { box-shadow: 0 6px 14px -4px rgba(0,0,0,0.8); }
  50%      { box-shadow: 0 6px 14px -4px rgba(0,0,0,0.8), 0 0 0 4px rgba(200,160,64,0.18); }
}

/* 入口：书脊按钮 */
.codex-knob {
  width: 36px;
  height: 52px;
  border-radius: 3px;
  background:
    linear-gradient(180deg, #5a2820 0%, #3a1a10 50%, #2a1208 100%);
  border: 1px solid #2a1208;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow:
    -2px 0 6px -2px rgba(0,0,0,0.7),
    2px 0 6px -2px rgba(0,0,0,0.5),
    0 1px 0 rgba(255,255,255,0.08) inset;
  animation: codex-knob-breathe 3.4s ease-in-out infinite;
}
.codex-knob:active {
  transform: scale(0.95);
  animation-play-state: paused;
}
.codex-knob-band {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, rgba(200, 160, 64, 0.8), transparent);
}
.codex-knob-band-1 { top: 8px; }
.codex-knob-band-2 { bottom: 8px; }
.codex-knob-spine {
  position: absolute;
  left: 4px;
  top: 14px;
  bottom: 14px;
  width: 1px;
  background: rgba(200, 160, 64, 0.4);
}
.codex-knob-emboss {
  font-family: 'Fraunces', serif;
  font-size: 9px;
  font-weight: 700;
  color: #c8a040;
  letter-spacing: 0.1em;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  text-shadow: 0 1px 0 rgba(0,0,0,0.6);
}

/* stage */
.codex-stage {
  background:
    radial-gradient(ellipse at 50% 30%, #f3e6c8 0%, #e6d3a8 100%);
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.2 0 0 0 0 0.15 0 0 0 0 0.08 0 0 0 0.15 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    radial-gradient(ellipse at 50% 30%, #f3e6c8 0%, #e6d3a8 100%);
  color: #3a2418;
}

/* header */
.codex-folio {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: #8a5a20;
}
.codex-title {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 22px;
  font-weight: 600;
  color: #3a2418;
  letter-spacing: -0.01em;
  line-height: 1;
  margin-top: 2px;
}
.codex-title .display {
  color: #c8a040;
}
.codex-icon-btn {
  width: 28px; height: 28px;
  background: rgba(200, 160, 64, 0.12);
  border: 1px solid #c8a040;
  border-radius: 4px;
  color: #8a5a20;
  font-family: 'Fraunces', serif;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
.codex-icon-btn:active { transform: scale(0.92); background: #c8a040; color: #fff; }
.codex-close-btn {
  background: transparent;
  border: none;
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 13px;
  color: #8a5a20;
  cursor: pointer;
}
.codex-close-btn:active { transform: scale(0.92); }

.codex-ornament-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4px 24px 8px;
  color: #c8a040;
  font-size: 12px;
  letter-spacing: 0.2em;
}
.codex-ornament-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, #c8a040 30%, #c8a040 70%, transparent);
  max-width: 60px;
}

/* spread (book) */
.codex-spread {
  position: relative;
  height: 100%;
  display: grid;
  grid-template-columns: 100px 8px 1fr;
  gap: 0;
  background:
    linear-gradient(180deg, #fdf6e2 0%, #f3e2bb 100%);
  border: 1px solid #c8a040;
  border-radius: 4px;
  padding: 12px;
  box-shadow:
    0 0 0 3px #3a2418 inset,
    0 0 0 4px #c8a040 inset,
    0 12px 30px -8px rgba(58, 36, 24, 0.6);
  overflow: hidden;
}
.codex-paper-grain {
  position: absolute;
  inset: 0;
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.2' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.3 0 0 0 0 0.2 0 0 0 0 0.1 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  pointer-events: none;
  mix-blend-mode: multiply;
  opacity: 0.6;
}

/* 书脊 */
.codex-spine {
  position: relative;
  height: 100%;
  background:
    linear-gradient(90deg, rgba(58, 36, 24, 0.08) 0%, transparent 30%);
  border-right: 1px solid #c8a040;
  overflow: hidden;
  z-index: 1;
}
.codex-wheel {
  position: absolute;
  inset: 0;
  cursor: grab;
}
.codex-wheel:active { cursor: grabbing; }

.codex-tab {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: opacity 0.18s;
  padding: 6px 4px;
}
.codex-tab-chapter {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 12px;
  font-weight: 600;
  color: #c8a040;
  letter-spacing: 0.04em;
  line-height: 1;
}
.codex-tab-label {
  font-family: 'Fraunces', serif;
  font-size: 18px;
  font-weight: 600;
  color: #3a2418;
  line-height: 1;
  letter-spacing: 0.02em;
}
.codex-tab-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: #8a5a20;
  text-transform: lowercase;
  letter-spacing: 0.15em;
  font-style: italic;
}
.codex-tab-active .codex-tab-chapter {
  color: #b48218;
  font-size: 14px;
}
.codex-tab-active .codex-tab-label {
  font-size: 22px;
  font-style: italic;
  color: #2a180a;
}

/* 烫金分隔 */
.codex-divider {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  z-index: 2;
}
.codex-divider::before {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  background: linear-gradient(to bottom, transparent, #c8a040 20%, #c8a040 80%, transparent);
}
.codex-divider-cap {
  font-size: 10px;
  color: #c8a040;
  background: #f3e2bb;
  padding: 4px 2px;
  z-index: 1;
}

/* 书页 */
.codex-page {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 8px 0 12px;
  z-index: 1;
  overflow: hidden;
}
.codex-page-header {
  flex-shrink: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(200, 160, 64, 0.4);
  margin-bottom: 6px;
}
.codex-page-chapter {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8a5a20;
}
.codex-page-heading {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 26px;
  font-weight: 600;
  color: #2a180a;
  line-height: 1.05;
  margin-top: 2px;
}
.codex-page-body {
  flex: 1;
  position: relative;
  min-height: 0;
}

.codex-preset-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.codex-preset-highlight {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: ${ITEM_HEIGHT}px;
  border-top: 1px solid #c8a040;
  border-bottom: 1px solid #c8a040;
  background: rgba(200, 160, 64, 0.10);
  pointer-events: none;
  z-index: 2;
}
.codex-preset-mask-top {
  position: absolute;
  left: 0; right: 0;
  top: 0;
  height: ${ITEM_HEIGHT * VISIBLE_BEFORE}px;
  background: linear-gradient(180deg, #fdf6e2 0%, rgba(253,246,226,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}
.codex-preset-mask-bot {
  position: absolute;
  left: 0; right: 0;
  bottom: 0;
  height: ${ITEM_HEIGHT * VISIBLE_AFTER}px;
  background: linear-gradient(0deg, #f3e2bb 0%, rgba(243,226,187,0.7) 60%, transparent 100%);
  pointer-events: none;
  z-index: 3;
}

.codex-entry {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  margin-top: -${ITEM_HEIGHT / 2}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 4px;
  font-family: 'Fraunces', serif;
  color: #3a2418;
  transition: opacity 0.18s;
}
.codex-entry-name {
  flex: 1;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.codex-entry-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #8a5a20;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  margin-left: 10px;
}
.codex-entry-active .codex-entry-name {
  font-size: 22px;
  font-weight: 600;
  font-style: italic;
  color: #2a180a;
}
.codex-entry-active .codex-entry-kcal {
  font-size: 17px;
  color: #b48218;
}

/* camera + empty */
.codex-camera, .codex-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}
.codex-camera-glyph { font-size: 36px; color: #c8a040; }
.codex-camera-label {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 18px;
  color: #3a2418;
}
.codex-camera-hint, .codex-empty-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: #8a5a20;
  letter-spacing: 0.1em;
}
.codex-empty-title { font-size: 22px; color: #3a2418; font-style: italic; }
.codex-empty-cta {
  background: #c8a040;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 8px 18px;
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}
.codex-empty-cta:active { transform: scale(0.95); }

.codex-colophon {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-align: center;
  padding: 8px 0 6px;
  letter-spacing: 0.06em;
}

.codex-seal {
  width: 100%;
  background:
    linear-gradient(180deg, #c8a040 0%, #8a5a20 100%);
  color: #fdf6e2;
  border: 1.5px solid #5a3a10;
  border-radius: 6px;
  padding: 14px 20px;
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  box-shadow:
    0 6px 16px -4px rgba(58, 36, 24, 0.6),
    0 1px 0 rgba(255,255,255,0.15) inset;
  transition: transform 0.14s;
  text-shadow: 0 1px 0 rgba(58, 36, 24, 0.4);
}
.codex-seal:active { transform: scale(0.98) translateY(1px); }
.codex-seal:disabled { opacity: 0.5; cursor: not-allowed; }
.codex-seal-emblem {
  font-size: 14px;
  color: #fdf6e2;
}

/* menu */
.codex-menu {
  background: #fdf6e2;
  border: 1px solid #c8a040;
  border-radius: 6px;
  min-width: 240px;
  box-shadow:
    0 0 0 3px #3a2418 inset,
    0 0 0 4px #c8a040 inset,
    0 18px 36px -8px rgba(0,0,0,0.5);
  overflow: hidden;
  padding: 6px;
  color: #3a2418;
}
.codex-menu-head {
  padding: 8px 12px 10px;
  border-bottom: 1px solid rgba(200, 160, 64, 0.4);
  text-align: center;
}
.codex-menu-name {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 18px;
  font-weight: 600;
  color: #2a180a;
}
.codex-menu-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #8a5a20;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.codex-menu-item {
  width: 100%;
  background: transparent;
  border: none;
  padding: 10px 14px;
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 15px;
  color: #3a2418;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  border-bottom: 1px dashed rgba(200, 160, 64, 0.3);
}
.codex-menu-item:last-child { border-bottom: none; }
.codex-menu-item:active { background: rgba(200, 160, 64, 0.12); }
.codex-menu-icon { color: #c8a040; width: 18px; text-align: center; }
.codex-menu-icon-danger { color: #a04030; }
.codex-menu-text-danger { color: #a04030; }
`;
