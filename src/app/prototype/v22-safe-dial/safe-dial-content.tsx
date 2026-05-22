'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Safe Dial 保險櫃密碼盤 — 主页 RealHomeShell 完整保留。
 *
 * 入口：右下角 44×44 金属旋钮按钮 + lime 指针，微妙弹簧动效。
 *
 * 展开：全屏 sheet，含
 *   - 中央大卡：当前 preset 完整 name + kcal + macro
 *   - 外圈拨盘：N 个区段（Recent / A-D / E-H / SAL / ...）按 name 前缀分桶
 *   - 内圈：当前区段下 ≤12 个 preset，旋转拨动选择
 *   - 底部 CRUD bar: REC / NEW / EDIT / DEL
 *
 * 找罕见 preset：tap 外圈某区段 = 直接跳；再拨内圈精选。
 */
type Segment = {
  label: string;     // 显示在外圈，如 "Recent" / "A-D" / "SAL"
  items: UserMealPreset[];
};

const STEP_DEG = 28;
const MAX_PER_SEGMENT = 12;

// 把 preset 拆分成 segments：第一段固定 "Recent"（按 created_at desc 取前 8 个）
// 其余按 name 首字母 / 首字分桶，每桶 ≤ 12
function buildSegments(presets: UserMealPreset[]): Segment[] {
  const segs: Segment[] = [];
  if (presets.length === 0) return segs;

  // Recent: 最新 8 个
  const recent = [...presets]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, Math.min(8, presets.length));
  if (recent.length > 0) {
    segs.push({ label: 'Recent', items: recent });
  }

  // 其余按 name 首字 grouping
  const sortedByName = [...presets].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  // 把所有 preset 按 firstChar 分桶
  type Bucket = { letter: string; items: UserMealPreset[] };
  const byLetter: Bucket[] = [];
  for (const p of sortedByName) {
    const letter = (p.name.charAt(0) || '?').toUpperCase();
    let bucket = byLetter[byLetter.length - 1];
    if (!bucket || bucket.letter !== letter) {
      bucket = { letter, items: [] };
      byLetter.push(bucket);
    }
    bucket.items.push(p);
  }

  // 合并相邻 letter 桶到 ≤12 个
  let cursor = 0;
  while (cursor < byLetter.length) {
    const start = cursor;
    let total = byLetter[cursor]!.items.length;
    cursor++;
    while (cursor < byLetter.length && total + byLetter[cursor]!.items.length <= MAX_PER_SEGMENT) {
      total += byLetter[cursor]!.items.length;
      cursor++;
    }
    const end = cursor - 1;
    const startLetter = byLetter[start]!.letter;
    const endLetter = byLetter[end]!.letter;
    const items = byLetter.slice(start, end + 1).flatMap((b) => b.items);
    // 单桶超过 12 个 → 取前 N 字符做更细前缀（暂简化为按 first 3 chars）
    if (items.length > MAX_PER_SEGMENT) {
      // 按 name.slice(0, 3) 细分
      const subs = new Map<string, UserMealPreset[]>();
      for (const it of items) {
        const k = it.name.slice(0, 3).toUpperCase();
        if (!subs.has(k)) subs.set(k, []);
        subs.get(k)!.push(it);
      }
      for (const [k, arr] of subs.entries()) {
        segs.push({ label: k, items: arr.slice(0, MAX_PER_SEGMENT) });
      }
    } else {
      const label = startLetter === endLetter ? startLetter : `${startLetter}-${endLetter}`;
      segs.push({ label, items });
    }
  }
  return segs;
}

export function SafeDialContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [segIdx, setSegIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const accumRef = useRef<number>(0);
  const dragLayerRef = useRef<'outer' | 'inner' | null>(null);

  const segments = useMemo(() => buildSegments(api.presets), [api.presets]);
  const safeSegIdx = segments.length === 0 ? 0 : Math.min(segIdx, segments.length - 1);
  const seg = segments[safeSegIdx];
  const safeItemIdx = !seg ? 0 : Math.min(itemIdx, seg.items.length - 1);
  const item = seg?.items[safeItemIdx];

  // 当 segIdx 变化时重置 itemIdx
  useEffect(() => { setItemIdx(0); }, [safeSegIdx]);

  function angleFromCenter(clientX: number, clientY: number): number {
    const el = dialRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  }

  function distanceFromCenter(clientX: number, clientY: number): number {
    const el = dialRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    lastAngleRef.current = angleFromCenter(t.clientX, t.clientY);
    accumRef.current = 0;
    const dist = distanceFromCenter(t.clientX, t.clientY);
    // 外圈拨盘 vs 内圈：以 dial 半径 70% 为界
    const el = dialRef.current;
    if (el) {
      const radius = el.getBoundingClientRect().width / 2;
      dragLayerRef.current = dist > radius * 0.65 ? 'outer' : 'inner';
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (lastAngleRef.current == null || !dragLayerRef.current) return;
    const t = e.touches[0]!;
    const a = angleFromCenter(t.clientX, t.clientY);
    let diff = a - lastAngleRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    lastAngleRef.current = a;
    accumRef.current += diff;
    while (Math.abs(accumRef.current) >= STEP_DEG) {
      const step = accumRef.current > 0 ? 1 : -1;
      accumRef.current -= step * STEP_DEG;
      if (dragLayerRef.current === 'outer' && segments.length > 0) {
        setSegIdx((i) => (i + step + segments.length) % segments.length);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6);
      } else if (dragLayerRef.current === 'inner' && seg && seg.items.length > 0) {
        setItemIdx((i) => (i + step + seg.items.length) % seg.items.length);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(3);
      }
    }
  }
  function onTouchEnd() {
    lastAngleRef.current = null;
    accumRef.current = 0;
    dragLayerRef.current = null;
  }

  async function handleRec() {
    if (!item) return;
    const ok = await api.recordCustomPreset(item);
    if (ok) setOpen(false);
  }

  return (
    <PrototypeShell title="1. Safe Dial 保險櫃密碼盤">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：右下旋钮 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open safe dial"
        className="fixed z-[70] safe-knob"
        style={{ right: 18, bottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}
      >
        <span className="safe-knob-pointer" aria-hidden />
        <span className="safe-knob-bevel" aria-hidden />
        <span className="safe-knob-sheen" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col safe-vault"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
              animation: 'vault-in 0.32s var(--ease-out-soft) both',
            }}
          >
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pb-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-mono">safe dial</p>
                <p className="text-[10px] font-mono text-text-3 mt-0.5">
                  {api.presets.length} preset · outer = segment · inner = item
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
            </div>

            {/* 中央 preset 大卡 */}
            <div className="flex-shrink-0 px-5 py-2">
              {item ? (
                <div className="safe-readout">
                  <p className="safe-readout-seg">
                    {seg?.label} · <span className="tabular">{safeItemIdx + 1}/{seg?.items.length}</span>
                  </p>
                  <p className="safe-readout-name">{item.name}</p>
                  <p className="safe-readout-kcal tabular">
                    {Math.round(item.kcal)}<span className="safe-readout-kcal-unit">kcal</span>
                  </p>
                  <p className="safe-readout-macro tabular">
                    <span style={{ color: '#c8ff00' }}>P{Math.round(item.protein_g)}</span>
                    <span className="opacity-50 mx-1.5">·</span>
                    <span style={{ color: '#f5a623' }}>C{Math.round(item.carb_g)}</span>
                    <span className="opacity-50 mx-1.5">·</span>
                    <span style={{ color: '#a486f4' }}>F{Math.round(item.fat_g)}</span>
                    <span className="opacity-50 mx-1.5">·</span>
                    <span className="text-text-3">Fi{Math.round(item.fiber_g)}</span>
                  </p>
                </div>
              ) : (
                <div className="safe-readout">
                  <p className="safe-readout-name text-text-3">No presets</p>
                  <p className="safe-readout-kcal tabular text-text-4">—</p>
                </div>
              )}
            </div>

            {/* 大圆盘 */}
            <div className="flex-1 flex items-center justify-center px-5 min-h-0">
              <div
                ref={dialRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
                className="safe-dial"
                style={{ touchAction: 'none' }}
              >
                {/* 外圈区段刻度 */}
                {segments.map((s, i) => {
                  const angle = (i / segments.length) * 360 - 90;
                  const isActive = i === safeSegIdx;
                  return (
                    <button
                      key={s.label + i}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSegIdx(i); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); }}
                      className={`safe-seg ${isActive ? 'safe-seg-active' : ''}`}
                      style={{
                        transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-120px) rotate(${-angle}deg)`,
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}

                {/* 内圈 preset 名（顶部当前 + 前后各 1 个） */}
                {seg && seg.items.length > 0 && [-1, 0, 1].map((offset) => {
                  const idx = (safeItemIdx + offset + seg.items.length) % seg.items.length;
                  const p = seg.items[idx];
                  if (!p) return null;
                  const angle = offset * 30 - 90;
                  const isActive = offset === 0;
                  return (
                    <span
                      key={p.id + offset}
                      className={`safe-item ${isActive ? 'safe-item-active' : ''}`}
                      style={{
                        transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-72px) rotate(${-angle}deg)`,
                      }}
                    >
                      {p.name.slice(0, 6)}
                    </span>
                  );
                })}

                {/* 中央 hub */}
                <div className="safe-hub">
                  <span className="safe-hub-glyph">◎</span>
                </div>

                {/* 外圈环 */}
                <div className="safe-ring-outer" />
                <div className="safe-ring-inner" />
              </div>
            </div>

            {/* CRUD bar */}
            <div className="flex-shrink-0 px-5 pt-2 pb-1">
              <div className="safe-crud">
                <button
                  onClick={handleRec}
                  disabled={!item || api.recordingId != null}
                  className="safe-rec"
                >
                  {api.recordingId ? 'recording…' : '● 記錄'}
                </button>
                <button
                  onClick={() => { api.clearDuplicate(); setCreateOpen(true); }}
                  className="safe-secondary"
                >＋ new</button>
                <button
                  onClick={() => { if (item) { api.clearDuplicate(); setEditOpen(true); } }}
                  disabled={!item}
                  className="safe-secondary"
                >✎ edit</button>
                <button
                  onClick={() => { if (item) setDelOpen(true); }}
                  disabled={!item}
                  className="safe-secondary safe-danger"
                >× del</button>
              </div>
            </div>
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

      {editOpen && item && (
        <FormSheet
          title={`✎ 編輯 · ${item.name}`}
          submitLabel="保存"
          initial={{ name: item.name, kcal: item.kcal }}
          onSubmit={async (name, kcal) => {
            const ok = await api.updatePreset(item.id, name, kcal);
            if (ok) setEditOpen(false);
          }}
          onCancel={() => setEditOpen(false)}
          duplicateName={api.duplicateName}
        />
      )}

      <InlineConfirmDialog
        open={delOpen}
        title="刪除這個 preset？"
        body={item ? <span>將永久移除「<span className="text-text font-medium">{item.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setDelOpen(false)}
        onConfirm={async () => {
          if (item) await api.deletePreset(item.id);
          setDelOpen(false);
          setItemIdx(0);
        }}
      />

      <style>{styles}</style>
    </PrototypeShell>
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
      <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative w-full max-w-[420px] bg-surface-2 border-t border-accent/40 px-5 pt-5 rounded-t-xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
      >
        <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">{title}</p>
        <MockPresetForm initial={initial} submitLabel={submitLabel} onSubmit={(n, k) => onSubmit(n, k)} onCancel={onCancel} />
        {duplicateName && <p className="text-[11px] text-danger mt-2 text-center">已存在同名 preset，請改名</p>}
      </div>
    </div>
  );
}

const styles = `
@keyframes vault-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes pointer-bounce {
  0%, 90%, 100% { transform: translateX(-50%) rotate(0deg); }
  93% { transform: translateX(-50%) rotate(8deg); }
  96% { transform: translateX(-50%) rotate(-4deg); }
}
@keyframes sheen-pass {
  0%, 100% { opacity: 0; }
  50% { opacity: 0.4; transform: translateX(-50%) rotate(180deg); }
}

/* 入口旋钮 */
.safe-knob {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.06) 0%, transparent 40%),
    linear-gradient(135deg, #2a2a32 0%, #15151a 60%, #0a0a0c 100%);
  border: 1px solid #3a3a44;
  position: relative;
  cursor: pointer;
  box-shadow:
    0 10px 22px -6px rgba(0,0,0,0.8),
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 -2px 4px rgba(0,0,0,0.5) inset;
  transition: transform 0.18s var(--ease-spring);
}
.safe-knob:active { transform: scale(0.92); }
.safe-knob-pointer {
  position: absolute;
  left: 50%;
  top: 6px;
  width: 2px;
  height: 14px;
  background: var(--color-accent);
  box-shadow: 0 0 6px rgba(200,255,0,0.7);
  transform: translateX(-50%);
  transform-origin: bottom center;
  animation: pointer-bounce 4.6s ease-in-out infinite;
  border-radius: 1px;
}
.safe-knob-bevel {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.05);
  pointer-events: none;
}
.safe-knob-sheen {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(200,255,0,0.4), transparent 30%);
  opacity: 0;
  animation: sheen-pass 5s ease-in-out infinite;
  animation-delay: 1.2s;
  pointer-events: none;
}

/* vault */
.safe-vault {
  background:
    radial-gradient(ellipse at 50% 30%, rgba(200,255,0,0.04) 0%, transparent 60%),
    linear-gradient(180deg, #0e0e12 0%, #15151a 100%);
}

/* preset 大卡 */
.safe-readout {
  text-align: center;
  padding: 12px 16px;
  border: 1px solid var(--color-hairline-strong);
  border-radius: 12px;
  background: rgba(28, 28, 34, 0.8);
}
.safe-readout-seg {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-3);
}
.safe-readout-name {
  font-size: 22px;
  font-weight: 500;
  color: var(--color-text);
  letter-spacing: -0.01em;
  margin-top: 4px;
  line-height: 1.15;
}
.safe-readout-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  color: var(--color-accent);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin-top: 6px;
}
.safe-readout-kcal-unit {
  font-size: 11px;
  color: var(--color-text-3);
  margin-left: 4px;
  font-weight: 400;
}
.safe-readout-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  margin-top: 6px;
}

/* dial */
.safe-dial {
  position: relative;
  width: min(320px, 86vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.05) 0%, transparent 35%),
    radial-gradient(circle at 70% 80%, rgba(255,255,255,0.02) 0%, transparent 40%),
    conic-gradient(from 0deg, #18181d 0deg, #1f1f25 90deg, #18181d 180deg, #1f1f25 270deg, #18181d 360deg);
  box-shadow:
    0 30px 70px -16px rgba(0,0,0,0.9),
    0 1px 0 rgba(255,255,255,0.05) inset;
}
.safe-ring-outer {
  position: absolute;
  inset: 6%;
  border-radius: 50%;
  border: 1px solid var(--color-hairline-strong);
  pointer-events: none;
}
.safe-ring-inner {
  position: absolute;
  inset: 28%;
  border-radius: 50%;
  border: 1px dashed var(--color-hairline);
  pointer-events: none;
}
.safe-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 28%;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08) 0%, transparent 60%),
    var(--color-surface-2);
  border: 1.5px solid var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 4px rgba(200,255,0,0.08),
    0 0 24px rgba(200,255,0,0.16),
    0 4px 12px -4px rgba(0,0,0,0.7);
  pointer-events: none;
}
.safe-hub-glyph {
  font-size: 22px;
  color: var(--color-accent);
  line-height: 1;
}

.safe-seg {
  position: absolute;
  left: 50%;
  top: 50%;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-3);
  background: none;
  border: 1px solid transparent;
  padding: 3px 5px;
  border-radius: 4px;
  cursor: pointer;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: color 0.16s, background 0.16s, border-color 0.16s;
  white-space: nowrap;
}
.safe-seg-active {
  color: var(--color-accent);
  background: rgba(200,255,0,0.12);
  border-color: rgba(200,255,0,0.4);
}

.safe-item {
  position: absolute;
  left: 50%;
  top: 50%;
  font-size: 11px;
  color: var(--color-text-3);
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  transition: color 0.16s, font-weight 0.16s;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.safe-item-active {
  color: var(--color-accent);
  font-weight: 700;
  font-size: 12px;
}

/* CRUD bar */
.safe-crud {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 6px;
}
.safe-rec {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: transform 0.14s;
}
.safe-rec:active { transform: scale(0.97); }
.safe-rec:disabled { opacity: 0.4; }
.safe-secondary {
  background: var(--color-surface-2);
  color: var(--color-text-2);
  border: 1px solid var(--color-hairline);
  border-radius: 10px;
  padding: 12px 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 0.14s, border-color 0.14s, color 0.14s;
}
.safe-secondary:hover { color: var(--color-accent); border-color: rgba(200,255,0,0.5); }
.safe-secondary:active { transform: scale(0.95); }
.safe-secondary:disabled { opacity: 0.35; }
.safe-danger {
  color: var(--color-danger);
}
.safe-danger:hover { color: var(--color-danger); border-color: rgba(255,77,77,0.5); }
`;
