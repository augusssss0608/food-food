'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import { PresetDialSheet, pickAIRecommended } from '../_lib/preset-dial-sheet';
import type { HomeSnapshot } from '@/lib/home-snapshot';

/**
 * Radial Bloom v2 — 主页结构保留。
 * 入口：右下角常驻小圆点。
 *
 * 关键改良 vs v1：
 * - 去掉 200ms 长按延时 → pointerDown 立即 bloom（手感快）
 * - 第 4 颗 satellite 改成「翻牌」入口 → 拉起 PresetDialSheet（翻牌选餐 + 搜索）
 *   不再开 grid sheet，避免「选完按钮又翻列表」的两段式路径
 *
 * 整套交互：按下 → 滑到目标 → 抬手 = 一次手势完成。
 */
type Petal = {
  key: 'p0' | 'p1' | 'p2' | 'dial';
  angle: number;
  label: string;
  sub?: string;
  glyph: string;
};

const RADIUS = 86;

export function RadialContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [dialOpen, setDialOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [hint, setHint] = useState(true);
  const centerRef = useRef<{ x: number; y: number } | null>(null);

  // top 3 preset 用 AI 推荐（按时间挑），剩 1 个 petal 是 dial
  const recommended = pickAIRecommended(api.presets);
  const [r0, r1, r2] = recommended;

  const petals: Petal[] = [
    {
      key: 'p0',
      angle: -150,
      label: r0 ? r0.name.slice(0, 5) : '—',
      sub: r0 ? `${Math.round(r0.kcal)}` : '',
      glyph: '★',
    },
    {
      key: 'p1',
      angle: -120,
      label: r1 ? r1.name.slice(0, 5) : '—',
      sub: r1 ? `${Math.round(r1.kcal)}` : '',
      glyph: '☆',
    },
    {
      key: 'p2',
      angle: -90,
      label: r2 ? r2.name.slice(0, 5) : '—',
      sub: r2 ? `${Math.round(r2.kcal)}` : '',
      glyph: '☆',
    },
    {
      key: 'dial',
      angle: -60,
      label: '全部',
      sub: `${api.presets.length}`,
      glyph: '⟳',
    },
  ];

  function bloom() {
    setOpen(true);
    setHint(false);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
  }

  function reset() {
    setOpen(false);
    setActiveIdx(null);
    centerRef.current = null;
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    bloom();
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!open || !centerRef.current) return;
    const dx = e.clientX - centerRef.current.x;
    const dy = e.clientY - centerRef.current.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < 28) {
      if (activeIdx !== null) setActiveIdx(null);
      return;
    }
    const theta = (Math.atan2(dy, dx) * 180) / Math.PI;
    let best = -1;
    let bestD = 999;
    petals.forEach((p, i) => {
      const d = Math.abs(((theta - p.angle + 540) % 360) - 180);
      if (d < bestD && d < 35) { bestD = d; best = i; }
    });
    if (best !== activeIdx) {
      setActiveIdx(best >= 0 ? best : null);
      if (best >= 0 && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
    }
  }

  async function onPointerUp() {
    if (open && activeIdx != null) {
      const petal = petals[activeIdx];
      reset();
      if (petal) await executePetal(petal);
    } else {
      reset();
    }
  }

  async function executePetal(petal: Petal) {
    if (petal.key === 'dial') {
      setDialOpen(true);
      return;
    }
    const map: Record<string, typeof r0> = { p0: r0, p1: r1, p2: r2 };
    const target = map[petal.key];
    if (target) await api.recordCustomPreset(target);
  }

  return (
    <PrototypeShell title="4. Radial Bloom v2">
      <RealHomeShell api={api} rightAction={null} />

      {/* 长按变暗遮罩 */}
      <div
        className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-[2px] transition-opacity pointer-events-none"
        style={{ opacity: open ? 1 : 0 }}
      />

      {/* hint 提示（首次） */}
      {hint && !open && (
        <div
          className="fixed z-[71] right-20 bg-surface-2 border border-hairline px-2.5 py-1.5 rounded-md"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.6rem)' }}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-2 whitespace-nowrap">
            press &amp; flick →
          </p>
        </div>
      )}

      {/* knob + 4 petals */}
      <div
        className="fixed right-6 z-[70] pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="relative" style={{ width: 56, height: 56 }}>
          {petals.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * RADIUS;
            const dy = Math.sin(rad) * RADIUS;
            const active = open && activeIdx === i;
            const disabled = p.key !== 'dial' && !{ p0: r0, p1: r1, p2: r2 }[p.key];
            return (
              <div
                key={p.key}
                className={`petal ${open ? 'petal-open' : ''} ${active ? 'petal-active' : ''} ${disabled ? 'petal-disabled' : ''} ${p.key === 'dial' ? 'petal-dial' : ''}`}
                style={{
                  transform: open
                    ? `translate(${dx}px, ${dy}px) scale(1)`
                    : 'translate(0,0) scale(0.3)',
                  transitionDelay: open ? `${i * 25}ms` : '0ms',
                }}
                aria-hidden
              >
                <span className="petal-glyph">{p.glyph}</span>
                <span className="petal-label">{p.label}</span>
                {p.sub && <span className="petal-sub tabular">{p.sub}</span>}
              </div>
            );
          })}

          <button
            type="button"
            aria-label="press to bloom"
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

      {/* dial sheet */}
      {dialOpen && (
        <PresetDialSheet
          presets={api.presets}
          recordingId={api.recordingId}
          aiRecommended={recommended}
          onPick={async (p) => {
            await api.recordCustomPreset(p);
            setDialOpen(false);
          }}
          onCreate={() => { api.clearDuplicate(); setDialOpen(false); setCreateOpen(true); }}
          onClose={() => setDialOpen(false)}
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

const styles = `
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
.knob:active { transform: scale(0.94); }
.knob-open {
  background: var(--color-accent);
  border-color: var(--color-accent);
  box-shadow:
    0 0 0 8px rgba(200,255,0,0.18),
    0 0 24px rgba(200,255,0,0.4);
  transform: scale(1.08);
}
.knob-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px rgba(200,255,0,0.6);
  transition: background 0.2s, box-shadow 0.2s;
}
.knob-open .knob-dot {
  background: var(--color-accent-ink);
  box-shadow: none;
  width: 6px; height: 6px;
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
  left: 50%; top: 50%;
  width: 56px; height: 56px;
  margin-left: -28px; margin-top: -28px;
  border-radius: 50%;
  background: rgba(28, 28, 34, 0.92);
  border: 1px solid var(--color-hairline-strong);
  backdrop-filter: blur(8px);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
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
.petal-open { opacity: 1; }
.petal-active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-ink);
  box-shadow: 0 0 16px rgba(200,255,0,0.5);
}
.petal-disabled { opacity: 0.35; }
.petal-dial {
  background: rgba(200, 255, 0, 0.10);
  border-color: rgba(200, 255, 0, 0.4);
  color: var(--color-accent);
}
.petal-dial.petal-active {
  background: var(--color-accent);
  color: var(--color-accent-ink);
}
.petal-glyph {
  font-size: 16px; line-height: 1; font-weight: 600;
}
.petal-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: lowercase;
  letter-spacing: 0.04em;
  max-width: 48px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.petal-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.petal-active .petal-sub { opacity: 1; font-weight: 700; }
`;
