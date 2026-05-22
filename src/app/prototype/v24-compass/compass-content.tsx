'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Compass Lens 航海羅盤 — 主页保留。
 * 入口：右下罗盘按钮（指针缓慢磁针漂移）。
 * 展开：大罗盘 + 8 方向（Recent/Rare/Light/Dense/Hi-P/Hi-C/Hi-F/All）。
 *   - 拨指针选方向 = 选寻找意图
 *   - 拇指画圆旋转：慢推 → 单步切 preset；快推（高角速度）→ 跳 10 个
 *   - 中央 readout 显示当前 preset 完整信息
 */
type IntentKey = 'recent' | 'rare' | 'light' | 'dense' | 'hp' | 'hc' | 'hf' | 'all';

const INTENTS: { key: IntentKey; label: string; sort: (a: UserMealPreset, b: UserMealPreset) => number }[] = [
  { key: 'recent', label: 'Recent', sort: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() },
  { key: 'rare',   label: 'Rare',   sort: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() },
  { key: 'light',  label: 'Light',  sort: (a, b) => a.kcal - b.kcal },
  { key: 'dense',  label: 'Dense',  sort: (a, b) => b.kcal - a.kcal },
  { key: 'hp',     label: 'Hi-P',   sort: (a, b) => b.protein_g - a.protein_g },
  { key: 'hc',     label: 'Hi-C',   sort: (a, b) => b.carb_g - a.carb_g },
  { key: 'hf',     label: 'Hi-F',   sort: (a, b) => b.fat_g - a.fat_g },
  { key: 'all',    label: 'A-Z',    sort: (a, b) => a.name.localeCompare(b.name, 'zh-Hant') },
];

const STEP_DEG = 22;
const FAST_SPEED_THRESHOLD = 0.6; // deg/ms

export function CompassContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<IntentKey>('recent');
  const [idx, setIdx] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [isFast, setIsFast] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accumRef = useRef<number>(0);

  const sequence = useMemo(() => {
    const sorter = INTENTS.find((i) => i.key === intent)!.sort;
    return [...api.presets].sort(sorter);
  }, [api.presets, intent]);

  const safeIdx = sequence.length === 0 ? 0 : Math.min(idx, sequence.length - 1);
  const item = sequence[safeIdx];

  // 当 intent 切换时重置 idx
  useEffect(() => { setIdx(0); }, [intent]);

  function angleFromCenter(clientX: number, clientY: number): number {
    const el = dialRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    lastAngleRef.current = angleFromCenter(t.clientX, t.clientY);
    lastTimeRef.current = Date.now();
    accumRef.current = 0;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (lastAngleRef.current == null) return;
    const t = e.touches[0]!;
    const now = Date.now();
    const a = angleFromCenter(t.clientX, t.clientY);
    let diff = a - lastAngleRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const dt = now - (lastTimeRef.current ?? now);
    const speed = dt > 0 ? Math.abs(diff) / dt : 0;
    const fast = speed > FAST_SPEED_THRESHOLD;
    if (fast !== isFast) setIsFast(fast);
    lastAngleRef.current = a;
    lastTimeRef.current = now;
    accumRef.current += diff;

    while (Math.abs(accumRef.current) >= STEP_DEG) {
      const dir = accumRef.current > 0 ? 1 : -1;
      accumRef.current -= dir * STEP_DEG;
      if (sequence.length > 0) {
        const stepCount = fast ? 10 : 1;
        setIdx((i) => (i + dir * stepCount + sequence.length * 10) % sequence.length);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(fast ? 12 : 4);
        }
      }
    }
  }
  function onTouchEnd() {
    lastAngleRef.current = null;
    lastTimeRef.current = null;
    accumRef.current = 0;
    setIsFast(false);
  }

  async function handleRec() {
    if (!item) return;
    const ok = await api.recordCustomPreset(item);
    if (ok) setOpen(false);
  }

  const currentIntent = INTENTS.find((i) => i.key === intent)!;

  return (
    <PrototypeShell title="3. Compass Lens 航海羅盤">
      <RealHomeShell api={api} rightAction={null} />

      {/* 入口：罗盘按钮 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open compass"
        className="fixed z-[70] compass-knob"
        style={{ right: 18, bottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}
      >
        <span className="compass-knob-ring" aria-hidden />
        <span className="compass-knob-needle" aria-hidden />
        <span className="compass-knob-n">N</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-0 flex flex-col compass-stage"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
              animation: 'compass-in 0.32s var(--ease-out-soft) both',
            }}
          >
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pb-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-mono">compass lens</p>
                <p className="text-[10px] font-mono text-text-3 mt-0.5">
                  intent: <span className="text-accent">{currentIntent.label}</span> · turn slow = step · turn fast = jump 10
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
            </div>

            {/* readout 大卡 */}
            <div className="flex-shrink-0 px-5 py-2">
              <div className="compass-readout">
                {item ? (
                  <>
                    <p className="compass-readout-meta">
                      {currentIntent.label} · <span className="tabular">{safeIdx + 1}/{sequence.length}</span>
                      {isFast && <span className="ml-2 text-accent font-bold">⚡ fast</span>}
                    </p>
                    <p className="compass-readout-name">{item.name}</p>
                    <p className="compass-readout-kcal tabular">
                      {Math.round(item.kcal)}<span className="compass-readout-kcal-unit">kcal</span>
                    </p>
                    <p className="compass-readout-macro tabular">
                      <span style={{ color: '#c8ff00' }}>P{Math.round(item.protein_g)}</span>
                      <span className="opacity-50 mx-1.5">·</span>
                      <span style={{ color: '#f5a623' }}>C{Math.round(item.carb_g)}</span>
                      <span className="opacity-50 mx-1.5">·</span>
                      <span style={{ color: '#a486f4' }}>F{Math.round(item.fat_g)}</span>
                    </p>
                  </>
                ) : (
                  <p className="compass-readout-name text-text-3">no preset</p>
                )}
              </div>
            </div>

            {/* 大罗盘 */}
            <div className="flex-1 flex items-center justify-center px-5 min-h-0">
              <div
                ref={dialRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
                className={`compass-dial ${isFast ? 'compass-dial-fast' : ''}`}
                style={{ touchAction: 'none' }}
              >
                {/* 蛛网刻度 */}
                {Array.from({ length: 16 }).map((_, i) => {
                  const a = (i / 16) * 360;
                  return (
                    <span
                      key={i}
                      className="compass-tick"
                      style={{
                        transform: `translate(-50%, -50%) rotate(${a}deg) translateY(-46%)`,
                      }}
                    />
                  );
                })}

                {/* 8 个方向 chip（罗盘标签） */}
                {INTENTS.map((it, i) => {
                  const a = (i / 8) * 360 - 90;
                  const isActive = intent === it.key;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIntent(it.key); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); }}
                      className={`compass-intent ${isActive ? 'compass-intent-active' : ''}`}
                      style={{
                        transform: `translate(-50%, -50%) rotate(${a}deg) translateY(-138px) rotate(${-a}deg)`,
                      }}
                    >
                      {it.label}
                    </button>
                  );
                })}

                {/* 中央罗经盘 */}
                <div className="compass-rose">
                  {/* N/E/S/W */}
                  <span className="compass-rose-n">N</span>
                  <span className="compass-rose-e">E</span>
                  <span className="compass-rose-s">S</span>
                  <span className="compass-rose-w">W</span>
                  {/* 指针 */}
                  <span className="compass-needle" aria-hidden />
                  <span className="compass-needle-pin" aria-hidden />
                </div>
              </div>
            </div>

            {/* CRUD bar */}
            <div className="flex-shrink-0 px-5 pt-2 pb-1">
              <div className="compass-crud">
                <button onClick={handleRec} disabled={!item || api.recordingId != null} className="compass-rec">
                  {api.recordingId ? 'recording…' : '● 記錄'}
                </button>
                <button onClick={() => { api.clearDuplicate(); setCreateOpen(true); }} className="compass-secondary">＋ new</button>
                <button onClick={() => { if (item) { api.clearDuplicate(); setEditOpen(true); } }} disabled={!item} className="compass-secondary">✎ edit</button>
                <button onClick={() => { if (item) setDelOpen(true); }} disabled={!item} className="compass-secondary compass-danger">× del</button>
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
          setIdx(0);
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
@keyframes compass-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes needle-drift {
  0%, 100% { transform: translate(-50%, -100%) rotate(-3deg); }
  50% { transform: translate(-50%, -100%) rotate(5deg); }
}

/* 入口罗盘按钮 */
.compass-knob {
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
.compass-knob:active { transform: scale(0.92); }
.compass-knob-ring {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 1px dashed rgba(200,255,0,0.18);
}
.compass-knob-needle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 16px;
  background: linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent) 50%, #555 50%, #555 100%);
  border-radius: 1px;
  transform-origin: bottom center;
  transform: translate(-50%, -100%);
  animation: needle-drift 4.8s ease-in-out infinite;
  box-shadow: 0 0 4px rgba(200,255,0,0.5);
}
.compass-knob-n {
  position: absolute;
  left: 50%;
  top: 6px;
  transform: translateX(-50%);
  font-family: 'JetBrains Mono', monospace;
  font-size: 7px;
  color: rgba(200,255,0,0.4);
  letter-spacing: 0.1em;
  font-weight: 700;
}

/* stage */
.compass-stage {
  background:
    radial-gradient(ellipse at 50% 30%, rgba(200,255,0,0.05) 0%, transparent 60%),
    linear-gradient(180deg, #0e0e12 0%, #15151a 100%);
}

/* readout */
.compass-readout {
  text-align: center;
  padding: 10px 14px;
  border: 1px solid var(--color-hairline-strong);
  border-radius: 12px;
  background: rgba(28, 28, 34, 0.85);
}
.compass-readout-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-3);
}
.compass-readout-name {
  font-size: 20px;
  font-weight: 500;
  color: var(--color-text);
  margin-top: 4px;
  line-height: 1.15;
}
.compass-readout-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  color: var(--color-accent);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin-top: 4px;
}
.compass-readout-kcal-unit {
  font-size: 10px;
  color: var(--color-text-3);
  margin-left: 4px;
  font-weight: 400;
}
.compass-readout-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  margin-top: 4px;
}

/* dial */
.compass-dial {
  position: relative;
  width: min(340px, 88vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.05) 0%, transparent 35%),
    radial-gradient(circle at 70% 80%, rgba(255,255,255,0.02) 0%, transparent 40%),
    linear-gradient(135deg, #1c1c22 0%, #15151a 100%);
  border: 1.5px solid var(--color-hairline-strong);
  box-shadow:
    0 30px 70px -16px rgba(0,0,0,0.9),
    0 1px 0 rgba(255,255,255,0.05) inset,
    0 0 60px rgba(200,255,0,0.04) inset;
  transition: box-shadow 0.18s, border-color 0.18s;
}
.compass-dial-fast {
  border-color: var(--color-accent);
  box-shadow:
    0 30px 70px -16px rgba(0,0,0,0.9),
    0 0 0 2px rgba(200,255,0,0.15),
    0 0 40px rgba(200,255,0,0.18) inset;
}

/* 蛛网刻度 */
.compass-tick {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 8px;
  background: var(--color-hairline-strong);
  transform-origin: center;
  pointer-events: none;
}

/* 方向 chip（外圈 8 个） */
.compass-intent {
  position: absolute;
  left: 50%;
  top: 50%;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--color-text-3);
  background: rgba(28, 28, 34, 0.9);
  border: 1px solid var(--color-hairline);
  padding: 5px 9px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.16s;
  text-transform: uppercase;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}
.compass-intent-active {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border-color: var(--color-accent);
  box-shadow: 0 0 14px rgba(200,255,0,0.4);
}

/* 中央罗经盘 */
.compass-rose {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 44%;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08) 0%, transparent 60%),
    linear-gradient(180deg, #2a2a32 0%, #15151a 100%);
  border: 1.5px solid var(--color-accent);
  box-shadow:
    0 0 0 4px rgba(200,255,0,0.08),
    0 0 24px rgba(200,255,0,0.18),
    0 4px 12px -4px rgba(0,0,0,0.7);
  pointer-events: none;
}
.compass-rose-n, .compass-rose-e, .compass-rose-s, .compass-rose-w {
  position: absolute;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-accent);
  letter-spacing: 0.04em;
}
.compass-rose-n { left: 50%; top: 6px; transform: translateX(-50%); }
.compass-rose-s { left: 50%; bottom: 6px; transform: translateX(-50%); }
.compass-rose-e { right: 6px; top: 50%; transform: translateY(-50%); }
.compass-rose-w { left: 6px; top: 50%; transform: translateY(-50%); }

.compass-needle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 40%;
  background: linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent) 50%, #555 50%, #555 100%);
  transform-origin: bottom center;
  transform: translate(-50%, -100%);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(200,255,0,0.5);
}
.compass-needle-pin {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 10px;
  background: var(--color-accent);
  border: 1.5px solid #15151a;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 8px rgba(200,255,0,0.7);
}

/* CRUD bar */
.compass-crud {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 6px;
}
.compass-rec {
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
.compass-rec:active { transform: scale(0.97); }
.compass-rec:disabled { opacity: 0.4; }
.compass-secondary {
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
.compass-secondary:hover { color: var(--color-accent); border-color: rgba(200,255,0,0.5); }
.compass-secondary:active { transform: scale(0.95); }
.compass-secondary:disabled { opacity: 0.35; }
.compass-danger { color: var(--color-danger); }
.compass-danger:hover { color: var(--color-danger); border-color: rgba(255,77,77,0.5); }
`;
