'use client';
import { useMemo, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Slot Reel 老虎機滾筒 — 主页保留。
 * 入口：右下机械窗口（kcal 数字滚动动效）。
 * 展开：3 滚筒 chip strip 并行筛选（频率 × name 段 × kcal 段）→ 中央命中 preset。
 * 候选缩到 1-5 个，左右 nudge 切换；CRUD 完整。
 */

type FreqKey = 'recent' | 'frequent' | 'all' | 'rare';
type NameKey = string; // 'A-D' / 'E-H' / 'I-N' / 'O-S' / 'T-Z' / 'CJK' / 'OTHER'
type KcalKey = 'k0-200' | 'k200-400' | 'k400-600' | 'k600+';

const FREQ_REELS: { key: FreqKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'frequent', label: 'Frequent' },
  { key: 'all', label: 'All' },
  { key: 'rare', label: 'Rare' },
];

const KCAL_REELS: { key: KcalKey; label: string; min: number; max: number }[] = [
  { key: 'k0-200', label: '0-200', min: 0, max: 200 },
  { key: 'k200-400', label: '200-400', min: 200, max: 400 },
  { key: 'k400-600', label: '400-600', min: 400, max: 600 },
  { key: 'k600+', label: '600+', min: 600, max: Number.POSITIVE_INFINITY },
];

function nameGroupOf(name: string): NameKey {
  const c = name.charAt(0);
  if (!c) return 'OTHER';
  // CJK：U+4E00 ~ U+9FFF
  const code = c.charCodeAt(0);
  if (code >= 0x4e00 && code <= 0x9fff) return 'CJK';
  const upper = c.toUpperCase();
  if (upper >= 'A' && upper <= 'D') return 'A-D';
  if (upper >= 'E' && upper <= 'H') return 'E-H';
  if (upper >= 'I' && upper <= 'N') return 'I-N';
  if (upper >= 'O' && upper <= 'S') return 'O-S';
  if (upper >= 'T' && upper <= 'Z') return 'T-Z';
  return 'OTHER';
}

const NAME_REELS: { key: NameKey; label: string }[] = [
  { key: 'A-D', label: 'A-D' },
  { key: 'E-H', label: 'E-H' },
  { key: 'I-N', label: 'I-N' },
  { key: 'O-S', label: 'O-S' },
  { key: 'T-Z', label: 'T-Z' },
  { key: 'CJK', label: '中' },
  { key: 'OTHER', label: '其他' },
];

export function SlotReelContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [freq, setFreq] = useState<FreqKey>('recent');
  const [nameFilter, setNameFilter] = useState<NameKey | null>(null);
  const [kcalFilter, setKcalFilter] = useState<KcalKey | null>(null);
  const [hitIdx, setHitIdx] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  // 候选 = 三滚筒 AND
  const candidates = useMemo(() => {
    let arr = [...api.presets];
    // 频率（用 created_at 作为代理：recent = 最新；rare = 最旧；frequent / all 全部）
    if (freq === 'recent') {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      arr = arr.slice(0, 20);
    } else if (freq === 'rare') {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      arr = arr.slice(0, 20);
    }
    if (nameFilter) {
      arr = arr.filter((p) => nameGroupOf(p.name) === nameFilter);
    }
    if (kcalFilter) {
      const range = KCAL_REELS.find((r) => r.key === kcalFilter);
      if (range) arr = arr.filter((p) => p.kcal >= range.min && p.kcal < range.max);
    }
    return arr;
  }, [api.presets, freq, nameFilter, kcalFilter]);

  const safeIdx = candidates.length === 0 ? 0 : Math.min(hitIdx, candidates.length - 1);
  const item = candidates[safeIdx];

  function nudge(dir: 1 | -1) {
    if (candidates.length === 0) return;
    setHitIdx((i) => (i + dir + candidates.length) % candidates.length);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6);
  }

  async function handleRec() {
    if (!item) return;
    const ok = await api.recordCustomPreset(item);
    if (ok) setOpen(false);
  }

  return (
    <PrototypeShell title="2. Slot Reel 老虎機滾筒">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：滚筒窗口 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open slot reel"
        className="fixed z-[70] reel-knob"
        style={{ right: 18, bottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}
      >
        <span className="reel-knob-window">
          <span className="reel-knob-digit reel-knob-d1">7</span>
          <span className="reel-knob-digit reel-knob-d2">2</span>
          <span className="reel-knob-digit reel-knob-d3">0</span>
        </span>
        <span className="reel-knob-frame" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col reel-stage"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
              animation: 'reel-in 0.32s var(--ease-out-soft) both',
            }}
          >
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pb-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-mono">slot reel</p>
                <p className="text-[10px] font-mono text-text-3 mt-0.5">
                  3 reels · candidates: <span className="text-accent tabular">{candidates.length}</span> / {api.presets.length}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
            </div>

            {/* 中央 readout + nudge */}
            <div className="flex-shrink-0 px-5 py-2">
              <div className="reel-readout">
                <button
                  type="button"
                  onClick={() => nudge(-1)}
                  disabled={candidates.length <= 1}
                  className="reel-nudge"
                  aria-label="previous"
                >‹</button>
                <div className="reel-readout-body">
                  {item ? (
                    <>
                      <p className="reel-readout-meta">
                        <span className="tabular">{safeIdx + 1}/{candidates.length}</span>
                      </p>
                      <p className="reel-readout-name">{item.name}</p>
                      <p className="reel-readout-kcal tabular">
                        {Math.round(item.kcal)}<span className="reel-readout-kcal-unit">kcal</span>
                      </p>
                      <p className="reel-readout-macro tabular">
                        <span style={{ color: '#c8ff00' }}>P{Math.round(item.protein_g)}</span>
                        <span className="opacity-50 mx-1.5">·</span>
                        <span style={{ color: '#f5a623' }}>C{Math.round(item.carb_g)}</span>
                        <span className="opacity-50 mx-1.5">·</span>
                        <span style={{ color: '#a486f4' }}>F{Math.round(item.fat_g)}</span>
                      </p>
                    </>
                  ) : (
                    <p className="reel-readout-name text-text-3">no match · 拨滚筒換條件</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => nudge(1)}
                  disabled={candidates.length <= 1}
                  className="reel-nudge"
                  aria-label="next"
                >›</button>
              </div>
            </div>

            {/* 3 滚筒 */}
            <div className="flex-1 px-3 pt-2 overflow-y-auto min-h-0">
              <ReelStrip
                title="frequency"
                chips={FREQ_REELS.map((r) => ({ key: r.key, label: r.label, active: freq === r.key }))}
                onSelect={(k) => { setFreq(k as FreqKey); setHitIdx(0); }}
              />
              <ReelStrip
                title="name"
                chips={NAME_REELS.map((r) => ({ key: r.key, label: r.label, active: nameFilter === r.key }))}
                onSelect={(k) => { setNameFilter(nameFilter === k ? null : (k as NameKey)); setHitIdx(0); }}
                allowDeselect
              />
              <ReelStrip
                title="kcal"
                chips={KCAL_REELS.map((r) => ({ key: r.key, label: r.label, active: kcalFilter === r.key }))}
                onSelect={(k) => { setKcalFilter(kcalFilter === k ? null : (k as KcalKey)); setHitIdx(0); }}
                allowDeselect
              />
              {/* reset */}
              {(nameFilter || kcalFilter || freq !== 'recent') && (
                <button
                  onClick={() => { setFreq('recent'); setNameFilter(null); setKcalFilter(null); setHitIdx(0); }}
                  className="reel-reset"
                >↺ reset 滚筒</button>
              )}
            </div>

            {/* CRUD bar */}
            <div className="flex-shrink-0 px-5 pt-2 pb-1">
              <div className="reel-crud">
                <button
                  onClick={handleRec}
                  disabled={!item || api.recordingId != null}
                  className="reel-rec"
                >
                  {api.recordingId ? 'recording…' : '● 記錄'}
                </button>
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="reel-secondary">＋ new</button>
                <button onClick={() => { if (item) { api.clearDuplicate(); setEditOpen(true); } }} disabled={!item} className="reel-secondary">✎ edit</button>
                <button onClick={() => { if (item) setDelOpen(true); }} disabled={!item} className="reel-secondary reel-danger">× del</button>
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
          setHitIdx(0);
        }}
      />

      <style>{styles}</style>
    </PrototypeShell>
  );
}

function ReelStrip({
  title, chips, onSelect, allowDeselect,
}: {
  title: string;
  chips: { key: string; label: string; active: boolean }[];
  onSelect: (key: string) => void;
  allowDeselect?: boolean;
}) {
  return (
    <div className="reel-strip">
      <div className="reel-strip-header">
        <p className="reel-strip-title">{title}</p>
        {allowDeselect && chips.some((c) => c.active) && (
          <p className="reel-strip-hint">tap again to clear</p>
        )}
      </div>
      <div className="reel-strip-track">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => onSelect(c.key)}
            className={`reel-chip ${c.active ? 'reel-chip-active' : ''}`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
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
    <div className="fixed inset-0 z-[160] flex items-end justify-center" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
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
@keyframes reel-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes digit-roll-1 {
  0%, 85%, 100% { transform: translateY(0); }
  90% { transform: translateY(-100%); }
  95% { transform: translateY(-50%); }
}
@keyframes digit-roll-2 {
  0%, 70%, 100% { transform: translateY(0); }
  80% { transform: translateY(-100%); }
  90% { transform: translateY(0); }
}

/* 入口 reel knob */
.reel-knob {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2a2a32 0%, #15151a 60%, #0a0a0c 100%);
  border: 1px solid #3a3a44;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 10px 22px -6px rgba(0,0,0,0.8),
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 -2px 4px rgba(0,0,0,0.5) inset;
  transition: transform 0.18s var(--ease-spring);
}
.reel-knob:active { transform: scale(0.92); }
.reel-knob-window {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.02em;
  box-shadow: 0 0 8px rgba(200,255,0,0.4);
}
.reel-knob-digit {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}
.reel-knob-d1 { animation: digit-roll-1 4.6s ease-in-out infinite; }
.reel-knob-d2 { animation: digit-roll-2 3.2s ease-in-out infinite; animation-delay: 0.6s; }
.reel-knob-d3 { animation: digit-roll-1 5.2s ease-in-out infinite; animation-delay: 1.4s; }
.reel-knob-frame {
  position: absolute;
  inset: 2px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.04);
  pointer-events: none;
}

/* stage */
.reel-stage {
  background:
    radial-gradient(ellipse at 50% 30%, rgba(200,255,0,0.04) 0%, transparent 60%),
    linear-gradient(180deg, #0e0e12 0%, #15151a 100%);
}

/* readout */
.reel-readout {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  gap: 4px;
  align-items: stretch;
  background: rgba(28, 28, 34, 0.85);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 12px;
  padding: 8px;
}
.reel-nudge {
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  font-size: 20px;
  color: var(--color-accent);
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
}
.reel-nudge:active { transform: scale(0.92); }
.reel-nudge:disabled { opacity: 0.3; }
.reel-readout-body {
  text-align: center;
  padding: 4px 8px;
  min-width: 0;
}
.reel-readout-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-text-3);
  letter-spacing: 0.15em;
}
.reel-readout-name {
  font-size: 20px;
  color: var(--color-text);
  font-weight: 500;
  margin-top: 4px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.reel-readout-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  color: var(--color-accent);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin-top: 4px;
}
.reel-readout-kcal-unit {
  font-size: 10px;
  color: var(--color-text-3);
  margin-left: 4px;
  font-weight: 400;
}
.reel-readout-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  margin-top: 4px;
}

/* reel strips */
.reel-strip {
  background: rgba(20, 20, 26, 0.8);
  border: 1px solid var(--color-hairline);
  border-radius: 10px;
  padding: 8px 10px 10px;
  margin-bottom: 6px;
}
.reel-strip-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}
.reel-strip-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--color-text-3);
}
.reel-strip-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: var(--color-text-4);
  text-transform: lowercase;
}
.reel-strip-track {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.reel-chip {
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  padding: 6px 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.14s;
  min-width: 40px;
  text-align: center;
}
.reel-chip:active { transform: scale(0.95); }
.reel-chip-active {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border-color: var(--color-accent);
  font-weight: 700;
  box-shadow: 0 0 12px rgba(200,255,0,0.25);
}

.reel-reset {
  width: 100%;
  background: transparent;
  border: 1px dashed var(--color-hairline-strong);
  color: var(--color-text-3);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: lowercase;
  letter-spacing: 0.06em;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 4px;
}
.reel-reset:hover { color: var(--color-accent); border-color: rgba(200,255,0,0.5); }

/* CRUD bar */
.reel-crud {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 6px;
}
.reel-rec {
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
.reel-rec:active { transform: scale(0.97); }
.reel-rec:disabled { opacity: 0.4; }
.reel-secondary {
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
.reel-secondary:hover { color: var(--color-accent); border-color: rgba(200,255,0,0.5); }
.reel-secondary:active { transform: scale(0.95); }
.reel-secondary:disabled { opacity: 0.35; }
.reel-danger { color: var(--color-danger); }
.reel-danger:hover { color: var(--color-danger); border-color: rgba(255,77,77,0.5); }
`;
