'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Tasting Palette — 主页 RealHomeShell 完整保留。
 * 入口：左侧极细 lime 色痕（3×96px），不挡主屏。
 *
 * 核心：preset 按宏量数据自动投影到 2D 平面（x = kcal 归一化, y = 蛋白比例）。
 * - 不分类、不分桶 —— 连续坐标，相似 macro 自然邻近
 * - 拇指 pointer 在 palette 上移动 → 上方浮 magnifier tooltip 显示完整名
 * - tap 点 = record；long-press 点 = 弹工具条 (record/edit/duplicate/delete)
 * - 用户记位置（"咖啡在左下轻处"，"鸡胸饭在右上高蛋白"）
 *
 * 不同于 Atlas 的"高密度识别面"：Palette 是"数据空间", 位置承载语义（kcal+macro），
 * 用户更容易形成"哪里有什么"的直觉记忆。
 */
function computePos(preset: UserMealPreset): { x: number; y: number } {
  // x: kcal 归一化（0-1000 kcal → 0.05-0.95，留边距）
  const x = 0.05 + Math.min(1, Math.max(0, preset.kcal / 1000)) * 0.90;
  // y: 蛋白比例（0-1 → 0.95-0.05，蛋白高在上方）
  const macroTotal = preset.protein_g + preset.carb_g + preset.fat_g;
  const proteinRatio = macroTotal > 0 ? preset.protein_g / macroTotal : 0.2;
  const y = 0.95 - Math.min(1, proteinRatio * 2.2) * 0.90;
  return { x, y };
}

function macroColor(preset: UserMealPreset): string {
  const p = preset.protein_g, c = preset.carb_g, f = preset.fat_g;
  const total = p + c + f;
  if (total === 0) return 'rgba(200,200,210,0.5)';
  const r = (200 * p + 245 * c + 122 * f) / total;
  const g = (255 * p + 166 * c + 77 * f) / total;
  const b = (0 * p + 35 * c + 219 * f) / total;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function discSize(kcal: number) {
  // 0 → 14px, 1000 → 30px
  return Math.max(14, Math.min(34, 14 + Math.sqrt(kcal / 1.5)));
}

export function PaletteContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [hoverPresetId, setHoverPresetId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const placed = useMemo(() => {
    return api.presets.map((p) => ({
      preset: p,
      pos: computePos(p),
      color: macroColor(p),
      size: discSize(p.kcal),
      glyph: p.name.charAt(0).toUpperCase(),
    }));
  }, [api.presets]);

  const editingPreset = editingId ? api.presets.find((p) => p.id === editingId) : null;

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onPaletteMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const dotEl = (el as HTMLElement | null)?.closest('[data-preset-id]') as HTMLElement | null;
    const id = dotEl?.dataset?.presetId ?? null;
    if (id !== hoverPresetId) {
      setHoverPresetId(id);
      if (id && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(3);
    }
    if (id) setTooltipPos({ x: e.clientX, y: e.clientY });
    else setTooltipPos(null);
  }
  function onPaletteLeave() {
    setHoverPresetId(null);
    setTooltipPos(null);
  }

  function onDotPointerDown(id: string) {
    longPressFiredRef.current = false;
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setLongPressedId(id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 420);
  }
  async function onDotClick(preset: UserMealPreset) {
    clearTimer();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([8, 30, 8]);
    setOpen(false);
    await api.recordCustomPreset(preset);
  }

  const hoverPreset = hoverPresetId ? api.presets.find((p) => p.id === hoverPresetId) : null;

  return (
    <PrototypeShell title="5. Tasting Palette">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：左侧 3×96px lime 色痕 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open tasting palette"
        className="fixed z-[70] palette-inlet"
        style={{
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <span className="palette-inlet-bar" />
        <span className="palette-inlet-label">
          <span>p</span><span>a</span><span>l</span><span>e</span><span>t</span><span>t</span><span>e</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/72 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 rounded-t-[20px] flex flex-col"
            style={{
              maxHeight: '82vh',
              animation: 'palette-up 0.32s var(--ease-out-soft) both',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-hairline-strong" />
            </div>

            <div className="flex-shrink-0 flex items-center justify-between px-4 pt-1 pb-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-mono">tasting palette</p>
                <p className="text-[10px] font-mono text-text-3 mt-0.5">
                  {api.presets.length} preset · x: kcal · y: protein
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
            </div>

            <div
              className="palette-canvas"
              onPointerMove={onPaletteMove}
              onPointerLeave={onPaletteLeave}
            >
              {/* 坐标轴提示 */}
              <span className="palette-axis palette-axis-y-top">↑ protein</span>
              <span className="palette-axis palette-axis-y-bot">fat / carb</span>
              <span className="palette-axis palette-axis-x-left">light kcal</span>
              <span className="palette-axis palette-axis-x-right">heavy kcal →</span>

              {/* 固定 photo + create + manual 在四角 */}
              <button
                onClick={() => { setOpen(false); /* TODO camera */ }}
                className="palette-corner palette-corner-tl"
                aria-label="camera"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <button
                onClick={() => { api.clearDuplicate(); setCreateOpen(true); setOpen(false); }}
                className="palette-corner palette-corner-br"
                aria-label="new preset"
              >
                ＋
              </button>
              <button
                onClick={() => { setManualOpen(true); setOpen(false); }}
                className="palette-corner palette-corner-bl"
                aria-label="manual one-shot"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>

              {placed.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-[12px] text-text-3 font-mono text-center">
                    empty palette · tap ＋ to create your first dot
                  </p>
                </div>
              ) : (
                placed.map(({ preset, pos, color, size, glyph }) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-preset-id={preset.id}
                    onClick={() => onDotClick(preset)}
                    onPointerDown={() => onDotPointerDown(preset.id)}
                    onPointerUp={() => clearTimer()}
                    onPointerCancel={() => clearTimer()}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={api.recordingId != null}
                    className={`palette-dot ${hoverPresetId === preset.id ? 'palette-dot-hover' : ''} ${api.recordingId === preset.id ? 'palette-dot-recording' : ''}`}
                    style={{
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      width: size,
                      height: size,
                      background: color,
                    }}
                    aria-label={`${preset.name} ${Math.round(preset.kcal)} kcal`}
                  >
                    <span className="palette-dot-glyph" style={{ color: 'rgba(10,10,12,0.75)' }}>
                      {glyph}
                    </span>
                  </button>
                ))
              )}
            </div>

            <p className="flex-shrink-0 text-[9px] text-text-4 font-mono text-center py-2 px-4 tracking-wider">
              move thumb to inspect · tap dot to log · long-press to edit
            </p>
          </div>
        </div>
      )}

      {/* magnifier tooltip */}
      {open && hoverPreset && tooltipPos && (
        <div
          className="fixed z-[120] pointer-events-none palette-tooltip"
          style={{
            left: tooltipPos.x,
            top: Math.max(tooltipPos.y - 70, 60),
            transform: 'translate(-50%, 0)',
          }}
        >
          <p className="palette-tooltip-name">{hoverPreset.name}</p>
          <p className="palette-tooltip-kcal tabular">
            {Math.round(hoverPreset.kcal)}
            <span className="text-[10px] text-text-3 ml-1 font-sans">kcal</span>
          </p>
          <p className="palette-tooltip-macro">
            <span style={{ color: '#c8ff00' }}>P{Math.round(hoverPreset.protein_g)}</span>
            <span className="opacity-50 mx-1">·</span>
            <span style={{ color: '#f5a623' }}>C{Math.round(hoverPreset.carb_g)}</span>
            <span className="opacity-50 mx-1">·</span>
            <span style={{ color: '#a486f4' }}>F{Math.round(hoverPreset.fat_g)}</span>
          </p>
        </div>
      )}

      {/* 长按工具条 */}
      {longPressedId && (
        <LongPressMenu
          preset={api.presets.find((p) => p.id === longPressedId)!}
          onRecord={() => {
            const p = api.presets.find((x) => x.id === longPressedId);
            setLongPressedId(null);
            if (p) { setOpen(false); api.recordCustomPreset(p); }
          }}
          onEdit={() => { setEditingId(longPressedId); setLongPressedId(null); setOpen(false); api.clearDuplicate(); }}
          onDuplicate={async () => {
            const p = api.presets.find((x) => x.id === longPressedId);
            setLongPressedId(null);
            if (p) { api.clearDuplicate(); await api.addPreset(`${p.name} (copy)`, p.kcal); }
          }}
          onDelete={() => { setDeletingId(longPressedId); setLongPressedId(null); }}
          onClose={() => setLongPressedId(null)}
        />
      )}

      {createOpen && (
        <FormSheet
          title="＋ 新斑點"
          submitLabel="保存"
          onSubmit={async (name, kcal) => {
            const ok = await api.addPreset(name, kcal);
            if (ok) setCreateOpen(false);
          }}
          onCancel={() => setCreateOpen(false)}
          duplicateName={api.duplicateName}
        />
      )}

      {editingPreset && (
        <FormSheet
          title={`✎ 編輯 · ${editingPreset.name}`}
          submitLabel="保存"
          initial={{ name: editingPreset.name, kcal: editingPreset.kcal }}
          onSubmit={async (name, kcal) => {
            const ok = await api.updatePreset(editingPreset.id, name, kcal);
            if (ok) setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
          duplicateName={api.duplicateName}
        />
      )}

      {manualOpen && (
        <FormSheet
          title="✎ 手輸一次性"
          submitLabel="記錄這一筆"
          onSubmit={async (name, kcal) => {
            const fakePreset = {
              id: 'manual-' + Date.now(),
              name, kcal, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0,
              created_at: new Date().toISOString(),
            } as UserMealPreset;
            await api.recordCustomPreset(fakePreset);
            setManualOpen(false);
          }}
          onCancel={() => setManualOpen(false)}
        />
      )}

      <InlineConfirmDialog
        open={deletingId != null}
        title="刪除這個斑點？"
        body={deletingId ? <span>將永久移除「<span className="text-text font-medium">{api.presets.find((p) => p.id === deletingId)?.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (deletingId) await api.deletePreset(deletingId);
          setDeletingId(null);
        }}
      />

      <style>{styles}</style>
    </PrototypeShell>
  );
}

function LongPressMenu({
  preset, onRecord, onEdit, onDuplicate, onDelete, onClose,
}: {
  preset: UserMealPreset;
  onRecord: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110]" onClick={onClose} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[20%] bg-surface-2 border border-accent/40 rounded-xl overflow-hidden min-w-[240px] shadow-2xl shadow-black/60"
        style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-hairline">
          <p className="text-[14px] text-text font-medium">{preset.name}</p>
          <p className="text-[11px] font-mono text-accent tabular mt-0.5">
            {Math.round(preset.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
          </p>
        </div>
        <MenuItem onClick={onRecord} icon="●" tone="accent">記錄這一筆</MenuItem>
        <MenuItem onClick={onEdit} icon="✎">編輯</MenuItem>
        <MenuItem onClick={onDuplicate} icon="⎘">複製</MenuItem>
        <MenuItem onClick={onDelete} icon="×" tone="danger">刪除</MenuItem>
      </div>
    </div>
  );
}

function MenuItem({ children, onClick, icon, tone }: { children: React.ReactNode; onClick: () => void; icon: string; tone?: 'accent' | 'danger' }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-left text-[13px] hover:bg-surface active:bg-surface border-b border-hairline last:border-b-0 flex items-center gap-3"
    >
      <span className={`w-4 text-center ${tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : 'text-text-3'}`}>
        {icon}
      </span>
      <span className={tone === 'danger' ? 'text-danger' : 'text-text'}>{children}</span>
    </button>
  );
}

function FormSheet({
  title, submitLabel, initial, onSubmit, onCancel, duplicateName,
}: {
  title: string;
  submitLabel: string;
  initial?: { name: string; kcal: number };
  onSubmit: (name: string, kcal: number) => void | Promise<void>;
  onCancel: () => void;
  duplicateName?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center"
      style={{ animation: 'ff-fade-in 0.2s ease-out both' }}
    >
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative w-full max-w-[420px] bg-surface-2 border-t border-hairline px-5 pt-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
      >
        <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">{title}</p>
        <MockPresetForm
          initial={initial}
          submitLabel={submitLabel}
          onSubmit={(name, kcal) => onSubmit(name, kcal)}
          onCancel={onCancel}
        />
        {duplicateName && (
          <p className="text-[11px] text-danger mt-2 text-center">已存在同名 preset，請改名</p>
        )}
      </div>
    </div>
  );
}

const styles = `
@keyframes palette-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.8); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }

/* 入口色痕 */
.palette-inlet {
  background: transparent;
  border: none;
  padding: 8px 6px 8px 0;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.palette-inlet-bar {
  display: block;
  width: 3px;
  height: 96px;
  background: var(--color-accent);
  border-radius: 0 999px 999px 0;
  box-shadow:
    0 0 6px rgba(200,255,0,0.5),
    0 0 12px rgba(200,255,0,0.18);
  opacity: 0.7;
  animation: ff-pulse-soft 2.4s ease-in-out infinite;
}
.palette-inlet-label {
  display: flex;
  flex-direction: column;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: var(--color-accent);
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
  opacity: 0.65;
}
.palette-inlet:active .palette-inlet-bar { transform: scaleX(2); opacity: 1; }

/* canvas */
.palette-canvas {
  position: relative;
  width: 100%;
  height: 480px;
  max-height: 70vh;
  background:
    radial-gradient(ellipse at 50% 50%, rgba(200, 255, 0, 0.02) 0%, transparent 60%),
    rgba(8, 8, 12, 0.7);
  border-top: 1px solid var(--color-hairline);
  border-bottom: 1px solid var(--color-hairline);
  overflow: hidden;
  touch-action: none;
}
.palette-axis {
  position: absolute;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-4);
  pointer-events: none;
  white-space: nowrap;
}
.palette-axis-y-top { top: 8px; left: 50%; transform: translateX(-50%); }
.palette-axis-y-bot { bottom: 8px; left: 50%; transform: translateX(-50%); }
.palette-axis-x-left { left: 8px; top: 50%; transform: translateY(-50%) rotate(-90deg); transform-origin: left center; }
.palette-axis-x-right { right: 8px; top: 50%; transform: translateY(-50%) rotate(-90deg); transform-origin: right center; }

.palette-corner {
  position: absolute;
  width: 28px; height: 28px;
  background: rgba(200, 255, 0, 0.10);
  border: 1.5px solid var(--color-accent);
  color: var(--color-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  transition: transform 0.14s, background 0.14s;
  z-index: 10;
}
.palette-corner:active {
  transform: scale(0.92);
  background: var(--color-accent);
  color: var(--color-accent-ink);
}
.palette-corner-tl { left: 28px; top: 22px; }
.palette-corner-tr { right: 28px; top: 22px; }
.palette-corner-bl { left: 28px; bottom: 22px; }
.palette-corner-br { right: 28px; bottom: 22px; }

.palette-dot {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.16s, box-shadow 0.16s;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.4) inset,
    0 -1px 1px rgba(0,0,0,0.2) inset,
    0 3px 6px rgba(0,0,0,0.4);
  z-index: 3;
}
.palette-dot-glyph {
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  font-size: 10px;
  font-weight: 700;
  user-select: none;
}
.palette-dot-hover {
  transform: translate(-50%, -50%) scale(1.5);
  box-shadow:
    0 0 0 3px rgba(200,255,0,0.4),
    0 1px 0 rgba(255,255,255,0.5) inset,
    0 8px 16px -4px rgba(0,0,0,0.7);
  z-index: 5;
}
.palette-dot:active { transform: translate(-50%, -50%) scale(0.88); }
.palette-dot-recording {
  animation: ff-pulse-soft 0.8s ease-in-out infinite;
}

/* tooltip */
.palette-tooltip {
  background: rgba(8, 8, 12, 0.96);
  border: 1px solid var(--color-accent);
  backdrop-filter: blur(12px) saturate(150%);
  padding: 8px 12px;
  border-radius: 10px;
  min-width: 150px;
  text-align: center;
  box-shadow:
    0 10px 24px -6px rgba(0,0,0,0.8),
    0 0 0 4px rgba(200,255,0,0.08);
  animation: ff-fade-in 0.12s ease-out both;
}
.palette-tooltip-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}
.palette-tooltip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
  margin-top: 4px;
}
.palette-tooltip-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.04em;
  margin-top: 4px;
}
`;
