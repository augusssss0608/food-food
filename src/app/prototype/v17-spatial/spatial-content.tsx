'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import {
  type MealBand, BAND_LABEL, presetsByBand, currentBand, pickByBand,
} from '../_lib/preset-bands';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Spatial Pop — 主页完全保留不变。
 * 入口：右下角 mini pill（28×100），显示当前时段 + 推荐 1 个。
 * 触发：tap pill → 12 chip 沿 radial fan 像粒子环绕指尖展开。
 * - chip 按时段 stagger，颜色按 band 渐变
 * - tap chip = record + chip 飞回 pill
 * - 长按 chip = swap 同 band 下一个
 * - tap 空白 / pill 再 tap = collapse
 */
const BANDS: MealBand[] = ['morning', 'noon', 'evening', 'snack'];
const BAND_COLOR: Record<MealBand, string> = {
  morning: '#ffb84d',
  noon: '#c8ff00',
  evening: '#7a4ddb',
  snack: '#ff7a45',
};
const PER_BAND = 3;
const FAN_RADIUS = 132;
const FAN_START_DEG = 195;
const FAN_END_DEG = -25;
const LONG_PRESS_MS = 420;

export function SpatialContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const nowBand = useMemo(() => currentBand(), []);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState<Record<MealBand, string[]>>({
    morning: [], noon: [], evening: [], snack: [],
  });
  const [createOpen, setCreateOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const longPressBandRef = useRef<{ band: MealBand; slot: number } | null>(null);

  useEffect(() => {
    if (api.presets.length === 0) return;
    setPinned((prev) => {
      const next = { ...prev };
      BANDS.forEach((band) => {
        if (next[band].length === 0) {
          next[band] = presetsByBand(api.presets, band).slice(0, PER_BAND).map((p) => p.id);
        }
      });
      return next;
    });
  }, [api.presets]);

  // 推荐 1 个显示在 pill 上：当前 band 的第一个 pin
  const headlinePreset = useMemo(() => {
    const id = pinned[nowBand]?.[0];
    if (id) return api.presets.find((p) => p.id === id);
    return pickByBand(api.presets, nowBand, 1)[0];
  }, [pinned, nowBand, api.presets]);

  // 12 chip = 4 band × 3 chip (按 band 顺序展开)
  const allChips: { chip: UserMealPreset | null; band: MealBand; slot: number }[] = useMemo(() => {
    const list: { chip: UserMealPreset | null; band: MealBand; slot: number }[] = [];
    BANDS.forEach((band) => {
      const ids = pinned[band] ?? [];
      for (let s = 0; s < PER_BAND; s++) {
        const id = ids[s];
        const chip = id ? api.presets.find((p) => p.id === id) ?? null : null;
        list.push({ chip, band, slot: s });
      }
    });
    return list;
  }, [pinned, api.presets]);

  function chipPos(i: number, total: number) {
    if (total <= 1) return { x: -120, y: -30 };
    const arc = FAN_START_DEG - FAN_END_DEG;
    const step = arc / (total - 1);
    const deg = FAN_START_DEG - i * step;
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad) * FAN_RADIUS, y: -Math.sin(rad) * FAN_RADIUS };
  }

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function swapAt(band: MealBand, slot: number) {
    setPinned((prev) => {
      const arr = [...prev[band]];
      const currentId = arr[slot];
      const inBand = presetsByBand(api.presets, band);
      const used = new Set(arr);
      const next = inBand.find((p) => p.id !== currentId && !used.has(p.id))
        ?? inBand.find((p) => p.id !== currentId);
      if (!next) return prev;
      arr[slot] = next.id;
      return { ...prev, [band]: arr };
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
  }

  function onChipPointerDown(band: MealBand, slot: number) {
    longPressFiredRef.current = false;
    longPressBandRef.current = { band, slot };
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      if (longPressBandRef.current) {
        swapAt(longPressBandRef.current.band, longPressBandRef.current.slot);
      }
    }, LONG_PRESS_MS);
  }
  function onChipPointerUp() { clearTimer(); }

  async function onChipClick(chip: UserMealPreset | null) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (!chip) {
      api.clearDuplicate();
      setOpen(false);
      setCreateOpen(true);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([8, 30, 8]);
    setOpen(false);
    await api.recordCustomPreset(chip);
  }

  return (
    <PrototypeShell title="4. Spatial Pop">
      <RealHomeShell api={api} rightAction={null} />

      {/* backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-[2px] transition-opacity"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={() => setOpen(false)}
      />

      {/* pill + fan container */}
      <div
        className="fixed right-4 z-[70] pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
      >
        <div className="relative" style={{ width: 100, height: 32 }}>
          {/* fan chips */}
          {allChips.map(({ chip, band, slot }, i) => {
            const { x, y } = chipPos(i, allChips.length);
            return (
              <button
                key={`${band}-${slot}`}
                onClick={() => onChipClick(chip)}
                onPointerDown={() => onChipPointerDown(band, slot)}
                onPointerUp={onChipPointerUp}
                onPointerCancel={onChipPointerUp}
                onPointerLeave={onChipPointerUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={!open || api.recordingId != null}
                className={`fan-chip ${chip ? '' : 'fan-chip-empty'}`}
                style={{
                  transform: open
                    ? `translate(${x}px, ${y}px) scale(1)`
                    : 'translate(0,0) scale(0.2)',
                  opacity: open ? 1 : 0,
                  transitionDelay: open ? `${i * 22}ms` : `${(allChips.length - i) * 12}ms`,
                  borderColor: open ? BAND_COLOR[band] : 'transparent',
                  pointerEvents: open ? 'auto' : 'none',
                }}
                aria-label={chip ? `${chip.name} ${Math.round(chip.kcal)} kcal` : 'empty'}
              >
                {chip ? (
                  <>
                    <span className="fan-chip-name">{chip.name}</span>
                    <span className="fan-chip-kcal tabular">{Math.round(chip.kcal)}</span>
                  </>
                ) : (
                  <span className="fan-chip-add">＋</span>
                )}
                <span
                  className="fan-chip-dot"
                  style={{ background: BAND_COLOR[band] }}
                  aria-hidden
                />
              </button>
            );
          })}

          {/* pill */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`pill pointer-events-auto ${open ? 'pill-open' : ''}`}
            aria-label={open ? 'collapse' : 'expand'}
          >
            <span className="pill-dot" style={{ background: BAND_COLOR[nowBand] }} aria-hidden />
            <span className="pill-text">
              <span className="pill-band">{BAND_LABEL[nowBand]}</span>
              <span className="pill-name">
                {headlinePreset ? headlinePreset.name.slice(0, 4) : 'add'}
              </span>
            </span>
            <span className="pill-arrow" aria-hidden>{open ? '×' : '⌃'}</span>
          </button>
        </div>
      </div>

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
.pill {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 6px;
  align-items: center;
  padding: 4px 10px 4px 8px;
  background: rgba(28, 28, 34, 0.92);
  border: 1px solid var(--color-hairline-strong);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.22s var(--ease-spring), border-color 0.18s, box-shadow 0.18s, background 0.18s;
  box-shadow:
    0 8px 22px -8px rgba(0,0,0,0.7),
    0 1px 0 rgba(255,255,255,0.05) inset;
  z-index: 5;
}
.pill:active { transform: scale(0.95); }
.pill-open {
  background: var(--color-accent);
  border-color: var(--color-accent);
  box-shadow:
    0 0 0 6px rgba(200,255,0,0.18),
    0 0 30px rgba(200,255,0,0.4);
  transform: scale(1.04);
}
.pill-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
  animation: ff-pulse-soft 1.8s ease-in-out infinite;
}
.pill-open .pill-dot { background: var(--color-accent-ink) !important; box-shadow: none; }
.pill-text {
  display: flex;
  align-items: baseline;
  gap: 4px;
  overflow: hidden;
}
.pill-band {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}
.pill-open .pill-band { color: var(--color-accent-ink); }
.pill-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-text-2);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pill-open .pill-name { color: var(--color-accent-ink); opacity: 0.75; }
.pill-arrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-accent);
  font-weight: 700;
}
.pill-open .pill-arrow { color: var(--color-accent-ink); }

.fan-chip {
  position: absolute;
  left: 50%; top: 50%;
  width: 56px; height: 56px;
  margin-left: -28px; margin-top: -28px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.06) 0%, transparent 60%),
    rgba(22, 22, 28, 0.95);
  border: 1.5px solid var(--color-hairline-strong);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 4px;
  cursor: pointer;
  transition:
    transform 0.34s var(--ease-spring),
    opacity 0.22s ease,
    border-color 0.18s,
    background 0.18s;
  box-shadow:
    0 6px 16px -6px rgba(0,0,0,0.7),
    0 1px 0 rgba(255,255,255,0.04) inset;
  z-index: 3;
  backdrop-filter: blur(8px);
}
.fan-chip:active {
  transform: translate(var(--tx, 0), var(--ty, 0)) scale(0.9) !important;
  background:
    radial-gradient(circle at 30% 25%, rgba(200,255,0,0.18) 0%, transparent 60%),
    rgba(200, 255, 0, 0.12) !important;
}
.fan-chip-empty {
  background: transparent;
  border-style: dashed;
  color: var(--color-text-4);
}
.fan-chip-name {
  font-size: 10.5px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
  line-height: 1.05;
}
.fan-chip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  color: var(--color-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.fan-chip-add { font-size: 16px; }
.fan-chip-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 5px; height: 5px;
  border-radius: 50%;
  box-shadow: 0 0 4px currentColor;
}
`;
