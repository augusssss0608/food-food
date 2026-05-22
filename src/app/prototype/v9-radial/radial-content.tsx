'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Radial Bloom — 主页结构保留不变。
 * 入口：右下角一颗小圆点，长按 200ms → 4 个 satellite 沿拇指弧绽放，
 * 拇指继续滑到目标释放即执行。整套交互一根手指完成、不离屏。
 */
type Petal = {
  key: 'p1' | 'p2' | 'photo' | 'all';
  angle: number; // degrees, atan2 polar，下方为正
  label: string;
  sub?: string;
  glyph: string;
};

const RADIUS = 86;
const HIT_RADIUS = 36;

export function RadialContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [hint, setHint] = useState(true);
  const longPressRef = useRef<number | null>(null);
  const centerRef = useRef<{ x: number; y: number } | null>(null);
  const knobRef = useRef<HTMLButtonElement>(null);

  const [p1, p2] = api.presets;

  const petals: Petal[] = [
    {
      key: 'p1',
      angle: -150,
      label: p1 ? p1.name.slice(0, 4) : '無 preset',
      sub: p1 ? `${Math.round(p1.kcal)}` : '—',
      glyph: '★',
    },
    {
      key: 'p2',
      angle: -120,
      label: p2 ? p2.name.slice(0, 4) : '無 preset',
      sub: p2 ? `${Math.round(p2.kcal)}` : '—',
      glyph: '☆',
    },
    {
      key: 'photo',
      angle: -90,
      label: '拍照',
      glyph: '◉',
    },
    {
      key: 'all',
      angle: -60,
      label: '全部',
      glyph: '⋯',
    },
  ];

  function bloom() {
    setOpen(true);
    setHint(false);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
  }

  function reset() {
    setOpen(false);
    setActiveIdx(null);
    centerRef.current = null;
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
    longPressRef.current = window.setTimeout(() => bloom(), 200);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!open || !centerRef.current) return;
    const dx = e.clientX - centerRef.current.x;
    const dy = e.clientY - centerRef.current.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < 28) {
      setActiveIdx(null);
      return;
    }
    const theta = (Math.atan2(dy, dx) * 180) / Math.PI;
    let best = -1;
    let bestD = 999;
    petals.forEach((p, i) => {
      let d = Math.abs(((theta - p.angle + 540) % 360) - 180);
      if (d < bestD && d < 35) { bestD = d; best = i; }
    });
    if (best !== activeIdx) {
      setActiveIdx(best >= 0 ? best : null);
      if (best >= 0 && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
    }
  }

  async function onPointerUp() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (open && activeIdx != null) {
      const petal = petals[activeIdx];
      reset();
      if (petal) await executePetal(petal);
    } else {
      reset();
    }
  }

  async function executePetal(petal: Petal) {
    if (petal.key === 'p1' && p1) {
      await api.recordCustomPreset(p1);
    } else if (petal.key === 'p2' && p2) {
      await api.recordCustomPreset(p2);
    } else if (petal.key === 'photo') {
      // prototype 不接 AI
      // 用 toast 提示即可
      // useHomeData 的 toast 没暴露出来，让用户在 sheet 里看
      setShowAll(true);
    } else if (petal.key === 'all') {
      setShowAll(true);
    }
  }

  return (
    <PrototypeShell title="4. Radial Bloom">
      <RealHomeShell api={api} rightAction={null} />

      {/* 长按变暗遮罩 */}
      <div
        className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-[2px] transition-opacity pointer-events-none"
        style={{ opacity: open ? 1 : 0 }}
      />

      {/* hint 提示泡泡（首次访问） */}
      {hint && !open && (
        <div
          className="fixed z-[71] right-20 bg-surface-2 border border-hairline px-2.5 py-1.5 rounded-md"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.6rem)' }}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-2 whitespace-nowrap">
            hold to bloom →
          </p>
        </div>
      )}

      {/* knob + bloom */}
      <div
        className="fixed right-6 z-[70] pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="relative" style={{ width: 56, height: 56 }}>
          {/* 4 个花瓣 */}
          {petals.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * RADIUS;
            const dy = Math.sin(rad) * RADIUS;
            const active = open && activeIdx === i;
            const disabled = (p.key === 'p1' && !p1) || (p.key === 'p2' && !p2);
            return (
              <div
                key={p.key}
                className={`petal ${open ? 'petal-open' : ''} ${active ? 'petal-active' : ''} ${disabled ? 'petal-disabled' : ''}`}
                style={{
                  transform: open
                    ? `translate(${dx}px, ${dy}px) scale(1)`
                    : 'translate(0,0) scale(0.3)',
                  transitionDelay: open ? `${i * 30}ms` : '0ms',
                }}
                aria-hidden
              >
                <span className="petal-glyph">{p.glyph}</span>
                <span className="petal-label">{p.label}</span>
                {p.sub && <span className="petal-sub tabular">{p.sub}</span>}
              </div>
            );
          })}

          {/* 中央 knob */}
          <button
            ref={knobRef}
            type="button"
            aria-label="hold to bloom"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            className={`knob ${open ? 'knob-open' : ''}`}
          >
            <span className="knob-dot" />
            {!open && <span className="knob-pulse" />}
          </button>
        </div>
      </div>

      {/* 全部 preset 抽屉 */}
      {showAll && (
        <AllPresetSheet
          presets={api.presets}
          recordingId={api.recordingId}
          onPick={async (p) => {
            await api.recordCustomPreset(p);
            setShowAll(false);
          }}
          onCreate={() => { api.clearDuplicate(); setShowAll(false); setCreateOpen(true); }}
          onClose={() => setShowAll(false)}
        />
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center"
          style={{ animation: 'ff-fade-in 0.2s ease-out both' }}
        >
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div
            className="relative w-full max-w-[420px] bg-surface-2 border-t border-hairline px-5 pt-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">＋ 新菜單</p>
            <MockPresetForm
              submitLabel="保存"
              onSubmit={async (name, kcal) => {
                const ok = await api.addPreset(name, kcal);
                if (ok) setCreateOpen(false);
              }}
              onCancel={() => setCreateOpen(false)}
            />
            {api.duplicateName && (
              <p className="text-[11px] text-danger mt-2 text-center">已存在同名菜單，請改名</p>
            )}
          </div>
        </div>
      )}

      <style>{styles}</style>
    </PrototypeShell>
  );
}

function AllPresetSheet({
  presets, recordingId, onPick, onCreate, onClose,
}: {
  presets: UserMealPreset[];
  recordingId: string | null;
  onPick: (p: UserMealPreset) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[150]" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 px-4 pt-4"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
          animation: 'drawer-up 0.28s var(--ease-out-soft) both',
          maxHeight: '60vh',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono">all menus</p>
          <button onClick={onClose} className="text-[11px] text-text-3 font-mono active:scale-95">close</button>
        </div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto" style={{ maxHeight: 'calc(60vh - 80px)' }}>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              disabled={recordingId != null}
              className="bg-surface border border-hairline px-3 py-2.5 text-left hover:border-accent/60 active:scale-95 transition-all disabled:opacity-50 rounded"
            >
              <p className="text-[12px] text-text font-medium truncate">{p.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">
                {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
              </p>
            </button>
          ))}
          <button
            onClick={onCreate}
            className="bg-surface border-2 border-dashed border-hairline-strong text-text-3 hover:text-accent hover:border-accent/60 active:scale-95 transition-all py-3 text-[11px] font-mono uppercase tracking-wider rounded"
          >
            ＋ new
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
@keyframes drawer-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.knob {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 10;
  transition: transform 0.2s var(--ease-spring), background 0.2s, border-color 0.2s;
  box-shadow:
    0 6px 14px -4px rgba(0,0,0,0.6),
    0 1px 0 rgba(255,255,255,0.05) inset;
}
.knob:active {
  transform: scale(0.94);
}
.knob-open {
  background: var(--color-accent);
  border-color: var(--color-accent);
  box-shadow:
    0 0 0 8px rgba(200,255,0,0.18),
    0 0 24px rgba(200,255,0,0.4);
  transform: scale(1.08);
}
.knob-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px rgba(200,255,0,0.6);
  transition: background 0.2s, box-shadow 0.2s;
}
.knob-open .knob-dot {
  background: var(--color-accent-ink);
  box-shadow: none;
  width: 6px;
  height: 6px;
}
.knob-pulse {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 1.5px solid var(--color-accent);
  opacity: 0;
  animation: knob-pulse 2.4s ease-out infinite;
  pointer-events: none;
}
@keyframes knob-pulse {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.45); opacity: 0; }
}

.petal {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 56px;
  height: 56px;
  margin-left: -28px;
  margin-top: -28px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1px solid var(--color-hairline-strong);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  opacity: 0;
  pointer-events: none;
  transition:
    transform 0.32s var(--ease-spring),
    opacity 0.22s ease,
    background 0.15s, border-color 0.15s, color 0.15s;
  z-index: 5;
  color: var(--color-text-2);
}
.petal-open {
  opacity: 1;
}
.petal-active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-ink);
  transform-origin: center;
  box-shadow: 0 0 16px rgba(200,255,0,0.5);
}
.petal-disabled {
  opacity: 0.35;
}
.petal-glyph {
  font-size: 16px;
  line-height: 1;
  font-weight: 600;
}
.petal-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: lowercase;
  letter-spacing: 0.04em;
  max-width: 48px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.petal-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.petal-active .petal-sub { opacity: 1; font-weight: 700; }
`;
