'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Stamp Atlas — 主页 RealHomeShell 完整保留。
 * 入口：右下角 22px 半透明印泥点，不挡任何主屏内容。
 *
 * 核心设计（来自跟 codex 多轮讨论的结论）：
 * - 100+ preset 不分类、不滚动、不翻牌、不搜索 → 唯一可行 = 「高密度识别面」
 * - 每个 preset 自动生成印章：字根（name 第 1 字）+ kcal 视觉重量（边框粗细 / 填充）
 * - 一屏容纳 80-100 个印章（28×28），看不下时自动缩到 24×24
 * - 拇指移过印章时 → 上方浮 magnifier tooltip 显示完整名 + kcal
 * - tap 印章 = record；long-press 印章 = 弹工具条 (record/edit/duplicate/delete)
 * - 第一行固定 3 槽：CAM / NEW / MANUAL（拍照 / 新 preset / 一次性手输）
 *
 * 不让用户主动摆位 / 绑码 / 打 tag：印章布局 = created_at desc + use freq 排序，
 * 用户的位置记忆是自然积累的，不是前置投入。
 */

type SortMode = 'recent' | 'name';

export function AtlasContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [hoverPresetId, setHoverPresetId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const sortedPresets = useMemo(() => {
    const arr = [...api.presets];
    if (sortMode === 'name') {
      arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    } else {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [api.presets, sortMode]);

  const editingPreset = editingId ? api.presets.find((p) => p.id === editingId) : null;

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onStampPointerDown(id: string) {
    longPressFiredRef.current = false;
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setLongPressedId(id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 420);
  }

  function onAtlasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const stampEl = (el as HTMLElement | null)?.closest('[data-stamp-id]') as HTMLElement | null;
    const id = stampEl?.dataset?.stampId ?? null;
    if (id !== hoverPresetId) {
      setHoverPresetId(id);
      if (id && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(3);
    }
    if (id) setTooltipPos({ x: e.clientX, y: e.clientY });
    else setTooltipPos(null);
  }

  function onAtlasPointerLeave() {
    setHoverPresetId(null);
    setTooltipPos(null);
  }

  async function onStampClick(preset: UserMealPreset) {
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
    <PrototypeShell title="4. Stamp Atlas">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：右下 22px 印泥点 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open stamp atlas"
        className="fixed z-[70] atlas-inlet"
        style={{
          right: 18,
          bottom: 'calc(env(safe-area-inset-bottom) + 18px)',
        }}
      >
        <span className="atlas-inlet-glyph" />
      </button>

      {/* atlas sheet */}
      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/72 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 rounded-t-[20px] flex flex-col"
            style={{
              maxHeight: '82vh',
              animation: 'atlas-up 0.32s var(--ease-out-soft) both',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-hairline-strong" />
            </div>

            <div className="flex-shrink-0 flex items-center justify-between px-4 pt-1 pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-mono">stamp atlas</p>
                <p className="text-[10px] font-mono text-text-3 mt-0.5">
                  {api.presets.length} preset · hold to inspect · tap to log
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSortMode((s) => (s === 'recent' ? 'name' : 'recent'))}
                  className="px-2 py-1 border border-hairline rounded text-[10px] font-mono uppercase tracking-wider text-text-2 hover:text-accent hover:border-accent/60 active:scale-95 transition-all"
                >
                  sort · {sortMode === 'recent' ? 'new' : 'a-z'}
                </button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
              </div>
            </div>

            <div
              className="atlas-canvas px-3 pt-1 pb-3"
              onPointerMove={onAtlasPointerMove}
              onPointerLeave={onAtlasPointerLeave}
            >
              {/* 固定 3 槽：CAM / NEW / MANUAL */}
              <div className="atlas-fixed-row">
                <button
                  type="button"
                  onClick={() => { setOpen(false); /* TODO 接 camera */ }}
                  className="atlas-fixed-cell atlas-fixed-cam"
                  aria-label="camera"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => { api.clearDuplicate(); setCreateOpen(true); setOpen(false); }}
                  className="atlas-fixed-cell atlas-fixed-new"
                  aria-label="new preset"
                >
                  <span>＋</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setManualOpen(true); setOpen(false); }}
                  className="atlas-fixed-cell atlas-fixed-manual"
                  aria-label="manual one-shot"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <div className="atlas-fixed-divider" aria-hidden />
              </div>

              {/* 印章 grid */}
              {sortedPresets.length === 0 ? (
                <p className="text-center text-[12px] text-text-3 font-mono py-12">
                  no preset · tap ＋ to create your first stamp
                </p>
              ) : (
                <div className="atlas-grid">
                  {sortedPresets.map((p) => (
                    <Stamp
                      key={p.id}
                      preset={p}
                      hover={hoverPresetId === p.id}
                      recording={api.recordingId === p.id}
                      onPointerDown={() => onStampPointerDown(p.id)}
                      onPointerUp={() => clearTimer()}
                      onClick={() => onStampClick(p)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* magnifier tooltip：跟随 pointer，上方浮出当前印章完整名 */}
      {open && hoverPreset && tooltipPos && (
        <div
          className="fixed z-[120] pointer-events-none atlas-tooltip"
          style={{
            left: tooltipPos.x,
            top: Math.max(tooltipPos.y - 64, 60),
            transform: 'translate(-50%, 0)',
          }}
        >
          <p className="atlas-tooltip-name">{hoverPreset.name}</p>
          <p className="atlas-tooltip-kcal tabular">
            {Math.round(hoverPreset.kcal)}
            <span className="text-[10px] text-text-3 ml-1 font-sans">kcal</span>
          </p>
          <p className="atlas-tooltip-macro">
            P {Math.round(hoverPreset.protein_g)} · C {Math.round(hoverPreset.carb_g)} · F {Math.round(hoverPreset.fat_g)}
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
            if (p) {
              setOpen(false);
              api.recordCustomPreset(p);
            }
          }}
          onEdit={() => { setEditingId(longPressedId); setLongPressedId(null); setOpen(false); api.clearDuplicate(); }}
          onDuplicate={async () => {
            const p = api.presets.find((x) => x.id === longPressedId);
            setLongPressedId(null);
            if (p) {
              api.clearDuplicate();
              const newName = `${p.name} (copy)`;
              await api.addPreset(newName, p.kcal);
            }
          }}
          onDelete={() => { setDeletingId(longPressedId); setLongPressedId(null); }}
          onClose={() => setLongPressedId(null)}
        />
      )}

      {/* 新建 preset */}
      {createOpen && (
        <FormSheet
          title="＋ 新印章"
          submitLabel="保存印章"
          onSubmit={async (name, kcal) => {
            const ok = await api.addPreset(name, kcal);
            if (ok) setCreateOpen(false);
          }}
          onCancel={() => setCreateOpen(false)}
          duplicateName={api.duplicateName}
        />
      )}

      {/* 编辑 preset */}
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

      {/* 手输一次性记录（不存为 preset） */}
      {manualOpen && (
        <FormSheet
          title="✎ 手輸一次性"
          submitLabel="記錄這一筆"
          onSubmit={async (name, kcal) => {
            // 手输不创建 preset，直接 record 一笔 manual meal
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

      {/* 删除确认 */}
      <InlineConfirmDialog
        open={deletingId != null}
        title="刪除這個印章？"
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

function Stamp({
  preset, hover, recording, onPointerDown, onPointerUp, onClick,
}: {
  preset: UserMealPreset;
  hover: boolean;
  recording: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onClick: () => void;
}) {
  // 字根：第 1 个字
  const glyph = preset.name.charAt(0).toUpperCase();
  // kcal 视觉重量：边框粗细
  const weight: 'light' | 'medium' | 'heavy' | 'solid' =
    preset.kcal < 100 ? 'light'
    : preset.kcal < 300 ? 'medium'
    : preset.kcal < 600 ? 'heavy'
    : 'solid';

  return (
    <button
      type="button"
      data-stamp-id={preset.id}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      disabled={recording}
      className={`stamp stamp-${weight} ${hover ? 'stamp-hover' : ''} ${recording ? 'stamp-recording' : ''}`}
      aria-label={`${preset.name} ${Math.round(preset.kcal)} kcal`}
    >
      <span className="stamp-glyph">{glyph}</span>
    </button>
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
          <p className="text-[11px] text-danger mt-2 text-center">已存在同名印章，請改名</p>
        )}
      </div>
    </div>
  );
}

const styles = `
@keyframes atlas-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes pop-in { 0% { transform: translate(-50%, 10px) scale(0.8); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }

/* 入口印泥点 */
.atlas-inlet {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.78);
  border: 1px solid var(--color-hairline-strong);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.18s var(--ease-spring), background 0.18s, border-color 0.18s;
  box-shadow: 0 6px 14px -4px rgba(0,0,0,0.6);
}
.atlas-inlet:active {
  transform: scale(0.92);
  background: var(--color-accent);
  border-color: var(--color-accent);
}
.atlas-inlet-glyph {
  width: 10px;
  height: 10px;
  background: var(--color-accent);
  box-shadow: 0 0 6px rgba(200,255,0,0.6);
  border-radius: 2px;
  animation: ff-pulse-soft 2.2s ease-in-out infinite;
}
.atlas-inlet:active .atlas-inlet-glyph { background: var(--color-accent-ink); box-shadow: none; }

/* atlas canvas */
.atlas-canvas {
  position: relative;
  overflow-y: auto;
  max-height: calc(82vh - 80px);
  touch-action: pan-y;
}
.atlas-fixed-row {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 36px);
  gap: 6px;
  margin-bottom: 8px;
  padding-bottom: 8px;
}
.atlas-fixed-divider {
  position: absolute;
  left: -8px;
  right: -8px;
  bottom: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--color-hairline-strong), transparent);
}
.atlas-fixed-cell {
  width: 36px;
  height: 36px;
  background: rgba(200, 255, 0, 0.10);
  border: 1.5px solid var(--color-accent);
  color: var(--color-accent);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 600;
  transition: transform 0.14s, background 0.14s;
}
.atlas-fixed-cell:active {
  transform: scale(0.92);
  background: var(--color-accent);
  color: var(--color-accent-ink);
}

/* 印章 grid */
.atlas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 6px;
}

.stamp {
  position: relative;
  aspect-ratio: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: transform 0.14s, border-color 0.14s, background 0.14s;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
}
.stamp-light {
  border: 1px solid var(--color-hairline);
  background: rgba(20, 20, 26, 0.7);
}
.stamp-medium {
  border: 1.5px solid var(--color-hairline-strong);
  background: var(--color-surface);
}
.stamp-heavy {
  border: 2px solid var(--color-text-3);
  background: var(--color-surface-2);
}
.stamp-solid {
  border: 2px solid var(--color-accent);
  background: rgba(200, 255, 0, 0.18);
}
.stamp-glyph {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1;
}
.stamp-solid .stamp-glyph { color: var(--color-accent); }
.stamp-hover {
  transform: scale(1.18);
  border-color: var(--color-accent);
  background: rgba(200, 255, 0, 0.22);
  z-index: 5;
  box-shadow:
    0 0 0 3px rgba(200,255,0,0.18),
    0 6px 16px -4px rgba(0,0,0,0.7);
}
.stamp-hover .stamp-glyph { color: var(--color-accent); }
.stamp:active { transform: scale(0.92); }
.stamp-recording {
  border-color: var(--color-accent);
  animation: ff-pulse-soft 0.8s ease-in-out infinite;
}

/* magnifier tooltip */
.atlas-tooltip {
  background: rgba(8, 8, 12, 0.96);
  border: 1px solid var(--color-accent);
  backdrop-filter: blur(12px) saturate(150%);
  padding: 8px 12px;
  border-radius: 10px;
  min-width: 140px;
  text-align: center;
  box-shadow:
    0 10px 24px -6px rgba(0,0,0,0.8),
    0 0 0 4px rgba(200,255,0,0.08);
  animation: ff-fade-in 0.12s ease-out both;
}
.atlas-tooltip-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}
.atlas-tooltip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
  margin-top: 4px;
}
.atlas-tooltip-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-text-3);
  letter-spacing: 0.04em;
  margin-top: 4px;
}
`;
